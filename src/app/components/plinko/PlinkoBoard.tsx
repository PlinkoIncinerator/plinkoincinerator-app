'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import Matter from 'matter-js';

interface PlinkoBoardProps {
  rows?: number;
  path: number[];
  isPlaying: boolean;
  onAnimationComplete?: () => void;
  multipliers: number[];
  riskMode: 'low' | 'medium' | 'high';
  showPathInitially?: boolean;
  onAddBall?: (path: number[]) => void;
  ballId?: number;
}

interface BallObject {
  body: Matter.Body;
  path: number[];
  active: boolean;
  pathPoints: {x: number, y: number, row: number}[];
  currentPathIndex: number;
  collisionBodyIds: Set<number>;
  prevCollisionTime: number;
  animationCompleted: boolean;
  expectedBinIndex?: number;  // Expected bucket to land in
  actualBinIndex?: number;    // Actual bucket it landed in
  hasLoggedResults: boolean;
}

interface PathWithMetadata {
  path: number[];
  isManuallyAdded: boolean;
}

export default function PlinkoBoard({
  rows = 16,
  path = [],
  isPlaying = false,
  onAnimationComplete,
  multipliers,
  riskMode = 'medium',
  showPathInitially = false,
  onAddBall,
  ballId = 0
}: PlinkoBoardProps) {
  const [showPath, setShowPath] = useState(showPathInitially);
  const [isBrowser, setIsBrowser] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pinRadiusRef = useRef<number>(0);
  const pinPositionsRef = useRef<{x: number, y: number, row: number}[]>([]);
  const activeBallsRef = useRef<BallObject[]>([]);
  const pendingPathRef = useRef<PathWithMetadata>({ path: [], isManuallyAdded: false });
  
  // Add constants for optimization
  const MAX_ACTIVE_BALLS = 100; // Maximum number of active balls to prevent performance issues
  const BALL_CLEANUP_DELAY = 800; // Shorter delay for ball cleanup
  
  // Use useRef for handleCollisions to avoid circular dependencies
  const handleCollisionsRef = useRef((event: Matter.IEventCollision<Matter.Engine>) => {});
  
  // Track previous ballId to detect changes
  const prevBallIdRef = useRef<number>(0);
  
  // Function to detect if we're on a mobile device - safely checking for window
  const isMobileDevice = useCallback(() => {
    if (!isBrowser) return false;
    return window.innerWidth < 768;
  }, [isBrowser]);
  
  // Set isBrowser to true when component mounts
  useEffect(() => {
    setIsBrowser(true);
  }, []);
  
  // Initialize handleCollisions once
  useEffect(() => {
    handleCollisionsRef.current = (event: Matter.IEventCollision<Matter.Engine>) => {
      const pairs = event.pairs;
      const now = Date.now();
      
      // Skip if no active balls
      if (activeBallsRef.current.length === 0) return;
      
      for (const pair of pairs) {
        // Find which ball (if any) is involved in this collision
        const activeBalls = activeBallsRef.current;
        
        for (let i = 0; i < activeBalls.length; i++) {
          const ballData = activeBalls[i];
          
          // Skip completed balls
          if (ballData.animationCompleted) continue;
          
          const ball = ballData.body;
          
          // If this ball collides with a pin
          if (
            (pair.bodyA === ball && pair.bodyB.isStatic && pair.bodyB.circleRadius) ||
            (pair.bodyB === ball && pair.bodyA.isStatic && pair.bodyA.circleRadius)
          ) {
            const pinBody = pair.bodyA === ball ? pair.bodyB : pair.bodyA;
            
            // Debounce collisions - reduce from 120ms to 100ms
            if (now - ballData.prevCollisionTime < 100) {
              continue;
            }
            
            // Prevent double counting the same pin
            if (ballData.collisionBodyIds.has(pinBody.id)) {
              continue;
            }
            
            // Find approximate row of this pin
            const pinY = pinBody.position.y;
            const rowEstimate = Math.floor((pinY - 60) / ((containerRef.current!.clientHeight - 120) / (rows + 1)));
            
            // Find the next target pin in our pre-calculated path
            if (ballData.currentPathIndex < ballData.pathPoints.length - 1 && rowEstimate >= ballData.currentPathIndex) {
              ballData.currentPathIndex++;
              const targetPin = ballData.pathPoints[ballData.currentPathIndex];
              
              if (!targetPin) continue;
              
              ballData.collisionBodyIds.add(pinBody.id);
              ballData.prevCollisionTime = now;
              
              // Calculate direction to the target pin
              const xDiff = targetPin.x - ball.position.x;
              const direction = Math.sign(xDiff);
              
              // Calculate and log the error distance
              const errorDistance = Math.sqrt(
                Math.pow(ball.position.x - targetPin.x, 2) + 
                Math.pow(ball.position.y - targetPin.y, 2)
              );
              console.log(`Pin collision at row ${targetPin.row}:`, {
                errorDistance: errorDistance.toFixed(2),
                ballX: ball.position.x.toFixed(2),
                ballY: ball.position.y.toFixed(2),
                expectedX: targetPin.x.toFixed(2),
                expectedY: targetPin.y.toFixed(2)
              });
              
              // Reset velocity first to have better control
              Matter.Body.setVelocity(ball, { x: 0, y: ball.velocity.y * 0.3 });
              
              // Apply a precise force to guide the ball to the exact target
              const forceStrength = 0.018; // Reduced from 0.025 for more predictable movement
              
              Matter.Body.applyForce(
                ball,
                ball.position,
                { 
                  x: direction * forceStrength, 
                  y: 0.002 // Reduced downward force
                }
              );
              
              // Additionally set direct velocity for immediate response - reduced velocity
              Matter.Body.setVelocity(ball, {
                x: direction * 1.8, // Reduced from 3.0
                y: 1.2 // Reduced from 2.0
              });
              
              // For large error distances, directly adjust position slightly
              if (errorDistance > 80) {
                const xCorrection = (targetPin.x - ball.position.x) * 0.1; // Move 10% of the way directly
                Matter.Body.setPosition(ball, {
                  x: ball.position.x + xCorrection,
                  y: ball.position.y
                });
              }
              
              break;
            }
          }
        }
      }
    };
  }, [rows]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (renderRef.current) {
        Matter.Render.stop(renderRef.current);
      }
      if (engineRef.current) {
        Matter.Engine.clear(engineRef.current);
      }
    };
  }, []);
  
  // Initialize physics engine
  useEffect(() => {
    // Skip if not in browser or refs not ready
    if (!isBrowser || !canvasRef.current || !containerRef.current) return;
    
    // Get container dimensions
    const containerWidth = containerRef.current.clientWidth;
    const containerHeight = containerRef.current.clientHeight;
    
    // Create engine with optimized settings to prevent sticking
    const engine = Matter.Engine.create({
      positionIterations: isMobileDevice() ? 6 : 8,   // Reduce iterations on mobile
      velocityIterations: isMobileDevice() ? 4 : 6,   // Reduce iterations on mobile
      enableSleeping: true,    // Enable sleeping for better performance
      constraintIterations: 2  // Fewer iterations for better performance
    });
    
    // Set engine parameters to improve simulation
    engine.timing.timeScale = isMobileDevice() ? 0.9 : 1.0; // Slightly slower on mobile for more predictable movement
    
    // Set gravity - decrease for more predictable ball movement
    engine.gravity.y = 0.8;  // Reduced from 1.2
    
    engineRef.current = engine;
    
    // Create renderer with performance optimizations
    const render = Matter.Render.create({
      canvas: canvasRef.current,
      engine: engine,
      options: {
        width: containerWidth,
        height: containerHeight,
        wireframes: false,
        background: 'transparent',
        pixelRatio: Math.min(window.devicePixelRatio || 1, isMobileDevice() ? 1.5 : 2), // Further limit pixel ratio on mobile
      }
    });
    renderRef.current = render;
    
    // Create world objects
    const world = engine.world;
    
    // Create walls
    const wallOptions = {
      isStatic: true,
      render: {
        fillStyle: '#334155'
      }
    };
    
    // Left and right walls
    Matter.Composite.add(world, [
      // Left wall
      Matter.Bodies.rectangle(
        0, 
        containerHeight / 2, 
        10, 
        containerHeight, 
        wallOptions
      ),
      // Right wall
      Matter.Bodies.rectangle(
        containerWidth, 
        containerHeight / 2, 
        10, 
        containerHeight, 
        wallOptions
      ),
      // Bottom wall
      Matter.Bodies.rectangle(
        containerWidth / 2, 
        containerHeight, 
        containerWidth, 
        10, 
        wallOptions
      ),
    ]);
    
    // Create dividers at the bottom for bins
    const binCount = multipliers.length;
    const binWidth = containerWidth / binCount;
    const dividerHeight = 70; // Taller dividers
    
    for (let i = 1; i < binCount; i++) {
      Matter.Composite.add(world, 
        Matter.Bodies.rectangle(
          i * binWidth, 
          containerHeight - (dividerHeight / 2), // Position from bottom
          3, // Thinner dividers
          dividerHeight, 
          wallOptions
        )
      );
    }
    
    // Add a top barrier to prevent the ball from going above the board
    Matter.Composite.add(world, 
      Matter.Bodies.rectangle(
        containerWidth / 2,
        5,
        containerWidth,
        10,
        wallOptions
      )
    );
    
    // Create pins
    const pinOptions = {
      isStatic: true,
      render: {
        fillStyle: '#ffffff'
      },
      restitution: 0.8,  // Increase bounciness
      friction: 0.01,    // Reduce friction
      chamfer: { radius: 2 }, // Rounded corners to reduce sticking
      slop: 0.2  // Add some slop to prevent sticking
    };
    
    // Calculate spacing for pins - we want 3 on top and 18 on bottom over 16 rows
    const topPins = 3;
    const bottomPins = 18;
    const pinsIncrement = (bottomPins - topPins) / (rows - 1);
    
    // Optimize pin size for mobile
    const pinRadius = isMobileDevice() 
      ? containerWidth / (bottomPins * 12)  // Smaller pins on mobile
      : containerWidth / (bottomPins * 10);
      
    // Store pinRadius in the ref
    pinRadiusRef.current = pinRadius;
    
    // Store all pin positions for path visualization
    const pinPositions: {x: number, y: number, row: number}[] = [];
    
    // Position pins in a triangular pattern
    for (let row = 0; row < rows; row++) {
      // Calculate number of pins in this row - ensure we get exactly 3 at top and 18 at bottom
      const rowPins = Math.round(topPins + (pinsIncrement * row));
      
      // Calculate horizontal spacing to ensure a proper triangle
      const spacing = containerWidth / (bottomPins + 1);
      const verticalSpacing = (containerHeight - 120) / (rows + 1);
      const offsetY = 60 + (row * verticalSpacing);
      
      // Calculate starting X position to center the pins
      const startX = (containerWidth - (rowPins - 1) * spacing) / 2;
      
      // Add pins for this row
      for (let i = 0; i < rowPins; i++) {
        const pin = Matter.Bodies.circle(
          startX + i * spacing,
          offsetY,
          pinRadius,
          pinOptions
        );
        Matter.Composite.add(world, pin);
        
        // Store pin position for path visualization
        pinPositions.push({
          x: startX + i * spacing,
          y: offsetY,
          row: row
        });
      }
    }
    
    // Sort pins by row for easier access
    pinPositions.sort((a, b) => a.row - b.row);
    pinPositionsRef.current = pinPositions;
    
    // Start the renderer
    Matter.Render.run(render);
    
    // Create runner
    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
    
    // Set up collision handling for multiple balls
    Matter.Events.on(engine, 'collisionStart', handleCollisionsRef.current);
    Matter.Events.on(engine, 'collisionActive', handleCollisionsRef.current);
    
    // Resize handler
    const handleResize = () => {
      if (containerRef.current && renderRef.current) {
        const newWidth = containerRef.current.clientWidth;
        const newHeight = containerRef.current.clientHeight;
        
        Matter.Render.setPixelRatio(renderRef.current, Math.min(window.devicePixelRatio || 1, isMobileDevice() ? 1.5 : 2));
        renderRef.current.options.width = newWidth;
        renderRef.current.options.height = newHeight;
        renderRef.current.canvas.width = newWidth;
        renderRef.current.canvas.height = newHeight;
        Matter.Render.lookAt(renderRef.current, {
          min: { x: 0, y: 0 },
          max: { x: newWidth, y: newHeight }
        });
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', handleResize);
      }
      Matter.Events.off(engine, 'collisionStart', handleCollisionsRef.current);
      Matter.Events.off(engine, 'collisionActive', handleCollisionsRef.current);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
    };
  }, [rows, multipliers, riskMode, isMobileDevice, isBrowser]);
  
  // Function to calculate path points
  const calculatePathPoints = (pathDirections: number[]) => {
    if (!containerRef.current) return [];
    
    const containerWidth = containerRef.current.clientWidth;
    const pathPoints: {x: number, y: number, row: number}[] = [];
    
    // Group pins by row
    const pinsByRow: {x: number, y: number}[][] = [];
    let lastRowIndex = -1;
    
    // Clone pins from ref
    const pinPositions = [...pinPositionsRef.current];
    
    // Group pins by row
    pinPositions.forEach(pin => {
      if (pin.row !== lastRowIndex) {
        pinsByRow[pin.row] = [];
        lastRowIndex = pin.row;
      }
      pinsByRow[pin.row].push({ x: pin.x, y: pin.y });
    });
    
    // Sort pins in each row by x position
    pinsByRow.forEach(row => row.sort((a, b) => a.x - b.x));
    
    // Start with the middle pin in the first row
    if (pinsByRow[0] && pinsByRow[0].length > 0) {
      const firstRowMiddleIndex = Math.floor(pinsByRow[0].length / 2);
      pathPoints.push({
        x: pinsByRow[0][firstRowMiddleIndex].x,
        y: pinsByRow[0][firstRowMiddleIndex].y,
        row: 0
      });
      
      // For each subsequent row, follow the path
      for (let i = 0; i < pathDirections.length; i++) {
        // Skip the first row since we already added it
        if (i === 0) continue;
        
        // Skip if this row doesn't exist or has no pins
        if (!pinsByRow[i] || pinsByRow[i].length === 0) continue;
        
        // Get the last pin from previous row
        const lastPin = pathPoints[pathPoints.length - 1];
        const lastPinX = lastPin.x;
        const lastPinRow = lastPin.row;
        
        // Get the direction for this transition (0=left, 1=right)
        const direction = pathDirections[lastPinRow];
        
        // Get the spacing between pins in current row
        const pinSpacing = pinsByRow[i].length > 1 
          ? (pinsByRow[i][1].x - pinsByRow[i][0].x) 
          : 20; // fallback
        
        // Calculate where the ball would land based on direction
        const bounceDirection = direction === 0 ? -1 : 1;
        const targetX = lastPinX + (bounceDirection * pinSpacing * 0.5);
        
        // Find the closest pin in the next row to where the ball would land
        let closestPinIndex = 0;
        let smallestDistance = Math.abs(pinsByRow[i][0].x - targetX);
        
        for (let j = 1; j < pinsByRow[i].length; j++) {
          const distance = Math.abs(pinsByRow[i][j].x - targetX);
          if (distance < smallestDistance) {
            smallestDistance = distance;
            closestPinIndex = j;
          }
        }
        
        // Add this pin to the path
        pathPoints.push({
          x: pinsByRow[i][closestPinIndex].x, 
          y: pinsByRow[i][closestPinIndex].y,
          row: i
        });
      }
    }
    
    return pathPoints;
  };
  
  // Memoize the drawPaths function
  const drawPaths = useCallback(() => {
    if (!renderRef.current || !renderRef.current.canvas || !showPath) return;
    
    // Get context from canvas
    const ctx = renderRef.current.canvas.getContext('2d');
    if (!ctx) return;
    
    // Store clean-up function
    const afterRender = () => {
      if (!showPath) return;
      
      const containerWidth = containerRef.current?.clientWidth || 800;
      
      // For better performance, limit the number of paths we draw
      // Only draw paths for the 5 most recent balls
      const ballsToDraw = activeBallsRef.current.slice(-5);
      
      for (const ballData of ballsToDraw) {
        if (ballData.pathPoints.length === 0) continue;
        
        // Draw the path for this ball
        ctx.beginPath();
        
        // Start position
        const startX = containerWidth / 2;
        const startY = 30;
        
        ctx.moveTo(startX, startY);
        
        // Simplify path drawing - only draw key points
        const step = Math.max(1, Math.floor(ballData.pathPoints.length / 10));
        for (let i = 0; i < ballData.pathPoints.length; i += step) {
          const point = ballData.pathPoints[i];
          ctx.lineTo(point.x, point.y);
        }
        
        // Always draw the last point
        if (ballData.pathPoints.length > 0) {
          const lastPoint = ballData.pathPoints[ballData.pathPoints.length - 1];
          ctx.lineTo(lastPoint.x, lastPoint.y);
          
          // Draw to the final position
          const finalY = containerRef.current?.clientHeight 
            ? containerRef.current.clientHeight - 35
            : 600;
          
          // Simplified bin calculation
          const binCount = multipliers.length;
          const binWidth = containerWidth / binCount;
          const binIndex = Math.min(
            Math.floor(lastPoint.x / binWidth),
            binCount - 1
          );
          const binCenterX = (binIndex * binWidth) + (binWidth / 2);
          
          ctx.lineTo(binCenterX, finalY);
        }
        
        // Set path style
        const pathIndex = activeBallsRef.current.indexOf(ballData) % 5;
        const pathColors = ['#22ff88', '#ff6622', '#2288ff', '#ffdd22', '#ff22dd'];
        ctx.strokeStyle = pathColors[pathIndex];
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Only draw error line for the ball's current pin position
        if (ballData.body && !ballData.animationCompleted && ballData.currentPathIndex > 0) {
          const ballPosition = ballData.body.position;
          
          // Get the current expected pin position
          const currentPin = ballData.pathPoints[ballData.currentPathIndex];
          
          if (currentPin) {
            // Calculate error distance
            const errorDistance = Math.sqrt(
              Math.pow(ballPosition.x - currentPin.x, 2) + 
              Math.pow(ballPosition.y - currentPin.y, 2)
            );
            
            // Draw error line only when ball is near the pin
            const pinProximityThreshold = pinRadiusRef.current * 10; // Threshold to show error line
            if (errorDistance < pinProximityThreshold) {
              // Draw the error line
              ctx.beginPath();
              ctx.moveTo(ballPosition.x, ballPosition.y);
              ctx.lineTo(currentPin.x, currentPin.y);
              
              // Draw with dashed red line to indicate error
              ctx.strokeStyle = '#ff3333';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([2, 2]);
              ctx.stroke();
              ctx.setLineDash([]);
              
              // Draw a small circle at the expected position
              ctx.beginPath();
              ctx.arc(currentPin.x, currentPin.y, 3, 0, Math.PI * 2);
              ctx.fillStyle = '#ff3333';
              ctx.fill();
            }
          }
        }
      }
    };
    
    // Clean up any existing render handlers
    if (renderRef.current && Matter.Events) {
      try {
        Matter.Events.off(renderRef.current, 'afterRender');
      } catch (error) {
        console.warn('Failed to remove existing afterRender event:', error);
      }
    }
    
    // Add custom rendering function
    Matter.Events.on(renderRef.current, 'afterRender', afterRender);
    
    return () => {
      if (renderRef.current && Matter.Events) {
        try {
          Matter.Events.off(renderRef.current, 'afterRender', afterRender);
        } catch (error) {
          console.warn('Failed to remove afterRender event during cleanup:', error);
        }
      }
    };
  }, [showPath, multipliers]);
  
  // Effect to manage paths drawing
  useEffect(() => {
    const cleanup = drawPaths();
    return cleanup;
  }, [drawPaths]);
  
  // Memoize the cleanupCompletedBalls function
  const cleanupCompletedBalls = useCallback(() => {
    // Find balls that have completed their animation
    const completedBalls = activeBallsRef.current.filter(ball => ball.animationCompleted);
    
    // If we have more than 3 active balls, or any completed balls, clean up
    if (completedBalls.length > 0 || activeBallsRef.current.length > MAX_ACTIVE_BALLS) {
      // Log completed ball results before cleanup
      completedBalls.forEach(ballData => {
        // Skip balls that have already had their results logged
        if (ballData.body && !ballData.hasLoggedResults) {
          ballData.hasLoggedResults = true; // Mark as logged to avoid duplicates
          
          // Calculate final bin position
          if (containerRef.current && ballData.body) {
            const containerWidth = containerRef.current.clientWidth;
            const binCount = multipliers.length;
            const binWidth = containerWidth / binCount;
            
            // Determine actual bin the ball landed in
            const actualBinIndex = Math.min(
              Math.floor(ballData.body.position.x / binWidth),
              binCount - 1
            );
            ballData.actualBinIndex = actualBinIndex;
            
            // Determine expected bin from the path data
            if (ballData.pathPoints.length > 0) {
              const lastPoint = ballData.pathPoints[ballData.pathPoints.length - 1];
              const expectedBinIndex = Math.min(
                Math.floor(lastPoint.x / binWidth),
                binCount - 1
              );
              ballData.expectedBinIndex = expectedBinIndex;
              
              // Log the results
              console.log('Ball result:', {
                expectedBin: expectedBinIndex,
                actualBin: actualBinIndex,
                expectedMultiplier: multipliers[expectedBinIndex],
                actualMultiplier: multipliers[actualBinIndex],
                match: expectedBinIndex === actualBinIndex ? 'Yes' : 'No'
              });
            }
          }
        }
      });
      
      // Remove completed balls from physics world
      completedBalls.forEach(ballData => {
        if (engineRef.current && ballData.body) {
          Matter.Composite.remove(engineRef.current.world, ballData.body);
        }
      });
      
      // Remove completed balls from active balls array
      activeBallsRef.current = activeBallsRef.current.filter(ball => !ball.animationCompleted);
      
      // If we still have too many balls, remove the oldest ones
      while (activeBallsRef.current.length > MAX_ACTIVE_BALLS) {
        const oldestBall = activeBallsRef.current[0];
        if (engineRef.current && oldestBall.body) {
          Matter.Composite.remove(engineRef.current.world, oldestBall.body);
        }
        activeBallsRef.current.shift();
      }
    }
  }, [multipliers]);
  
  // Memoize the createBall function - moved up to before its usage in useEffect
  const createBall = useCallback((pathDirections: number[]) => {
    if (!engineRef.current || !containerRef.current) return;
    
    const containerWidth = containerRef.current.clientWidth;
    
    // Create a ball with a unique color based on index
    const ballIndex = activeBallsRef.current.length % 5;
    const ballColors = ['#22ff88', '#ff6622', '#2288ff', '#ffdd22', '#ff22dd'];
    
    // Optimize the ball for better performance and control
    const ball = Matter.Bodies.circle(
      containerWidth / 2, // Start in middle
      30, // A bit lower to avoid top barrier
      pinRadiusRef.current * 1.1, // Slightly smaller relative to pins
      {
        restitution: 0.2, // Less bounce for more predictable movement (reduced from 0.3)
        friction: 0.01, // Increased friction for more control (was 0.001)
        frictionAir: 0.001, // Increased air friction for slower movement (was 0.0001)
        frictionStatic: 0.01, // Increased static friction for more control (was 0.0001)
        density: 0.04, // Heavier ball for more momentum control (was 0.02)
        render: {
          fillStyle: ballColors[ballIndex],
          visible: true, // Ensure ball is visible
        },
        sleepThreshold: 60 // Allow balls to sleep for better performance
      }
    );
    
    // Add ball to world
    Matter.Composite.add(engineRef.current.world, ball);
    
    // Apply initial velocity - slower for more control
    Matter.Body.setVelocity(ball, { x: 0, y: 1.5 }); // Reduced from 3
    
    // Calculate the path points - optimize by limiting updates
    const pathPoints = calculatePathPoints(pathDirections);
    
    // Create ball object
    const ballObject: BallObject = {
      body: ball,
      path: pathDirections,
      active: true,
      pathPoints,
      currentPathIndex: 0,
      collisionBodyIds: new Set(),
      prevCollisionTime: 0,
      animationCompleted: false,
      hasLoggedResults: false
    };
    
    // Add to active balls
    activeBallsRef.current.push(ballObject);
    
    return ballObject;
  }, []);
  
  // Set up a regular cleanup timer with the memoized function
  useEffect(() => {
    const cleanupInterval = setInterval(cleanupCompletedBalls, 500);
    return () => clearInterval(cleanupInterval);
  }, [cleanupCompletedBalls]);
  
  // Handle the animation when isPlaying changes with memoized functions
  useEffect(() => {
    // Only create a new ball when ballId changes and is greater than the previous value
    if (isPlaying && path.length > 0 && ballId > prevBallIdRef.current) {
      // Update previous ballId
      prevBallIdRef.current = ballId;
      
      // Clean up old balls first to maintain performance
      cleanupCompletedBalls();
      
      // Only add a new ball if we're under the limit
      if (activeBallsRef.current.length < MAX_ACTIVE_BALLS) {
        // Store this path for later creation
        pendingPathRef.current.path = path;
        
        // Create a new ball
        console.log("Creating new ball from ballId change:", ballId);
        createBall(path);
      } else {
        console.log("Too many active balls, skipping creation");
      }
    }
  }, [isPlaying, path, ballId, cleanupCompletedBalls, createBall]);
  
  return (
    <div 
      ref={containerRef} 
      className="w-full h-full relative overflow-hidden rounded-lg touch-none"
      style={{ minHeight: isMobileDevice() ? '85vh' : '500px' }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      
      {/* Controls - desktop only */}
      {isBrowser && !isMobileDevice() && path.length > 0 && (
        <div className="absolute top-2 right-2 z-10 flex gap-2">
          <button 
            className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md opacity-70 hover:opacity-100"
            onClick={() => setShowPath(!showPath)}
          >
            {showPath ? 'Hide Path' : 'Show Path'}
          </button>
        </div>
      )}
      
      {/* Multiplier display at the bottom */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between">
        {multipliers.map((multiplier, index) => {
          // Determine color based on multiplier value
          let bgColor = 'bg-blue-500';
          
          if (multiplier >= 10) bgColor = 'bg-red-500';
          else if (multiplier >= 3) bgColor = 'bg-orange-500';
          else if (multiplier >= 1) bgColor = 'bg-yellow-500';
          else if (multiplier >= 0.5) bgColor = 'bg-green-500';
          else bgColor = 'bg-purple-500';
          
          return (
            <div 
              key={index}
              className={`text-xs md:text-sm px-1 py-1 ${bgColor} text-white rounded flex items-center justify-center`}
              style={{ 
                width: `${100 / multipliers.length}%`,
                fontSize: isBrowser && isMobileDevice() && multipliers.length > 15 ? '0.45rem' : 
                          multipliers.length > 15 ? '0.5rem' : undefined,
                fontWeight: 'bold'
              }}
            >
              {multiplier}x
            </div>
          );
        })}
      </div>
    </div>
  );
} 