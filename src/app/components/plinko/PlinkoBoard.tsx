"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import Matter from "matter-js";

interface PlinkoBoardProps {
  rows?: number;
  path: number[];
  isPlaying: boolean;
  onAnimationComplete?: () => void;
  multipliers: number[];
  riskMode: "low" | "medium" | "high";
  onAddBall?: (path: number[]) => void;
  ballId?: number;
  resultBin?: number;
}

const DESIGN_WIDTH = 1111;
const DESIGN_HEIGHT = 600;

// TODO move to backend?
function getRandomStartPositionForBin(
  binNumber: number
): { y: number; x: number } | null {
  const startPositions: Record<number, { y: number; x: number }[]> = {
    1: [
      { y: 0, x: 462 },
      { y: 0, x: 459 },
    ],
    2: [{ y: 0, x: 402 }],
    3: [
      { y: 0, x: 497 },
      { y: 0, x: 435 },
    ],
    4: [
      { y: 0, x: 488 },
      { y: 0, x: 526 },
      { y: 0, x: 580 },
    ],
    5: [
      { y: 0, x: 490 },
      { y: 0, x: 496 },
      { y: 0, x: 525 },
      { y: 0, x: 549 },
      { y: 0, x: 555 },
    ],
    6: [
      { y: 0, x: 494 },
      { y: 0, x: 498 },
      { y: 0, x: 519 },
      { y: 0, x: 576 },
      { y: 0, x: 608 },
    ],
    7: [
      { y: 0, x: 491 },
      { y: 0, x: 499 },
      { y: 0, x: 517 },
      { y: 0, x: 518 },
      { y: 0, x: 546 },
    ],
    8: [
      { y: 0, x: 605 },
      { y: 0, x: 609 },
    ],
    9: [
      { y: 0, x: 500 },
      { y: 0, x: 505 },
      { y: 0, x: 534 },
      { y: 0, x: 578 },
      { y: 0, x: 619 },
    ],
    10: [
      { y: 0, x: 506 },
      { y: 0, x: 558 },
      { y: 0, x: 587 },
      { y: 0, x: 590 },
    ],
    11: [
      { y: 0, x: 529 },
      { y: 0, x: 583 },
      { y: 0, x: 594 },
      { y: 0, x: 613 },
    ],
    12: [
      { y: 0, x: 503 },
      { y: 0, x: 533 },
      { y: 0, x: 560 },
      { y: 0, x: 565 },
      { y: 0, x: 592 },
    ],
    13: [
      { y: 0, x: 504 },
      { y: 0, x: 522 },
      { y: 0, x: 527 },
    ],
    14: [
      { y: 0, x: 531 },
      { y: 0, x: 585 },
      { y: 0, x: 623 },
    ],
    15: [{ y: 0, x: 614 }],
    16: [{ y: 0, x: 709 }],
    17: [
      { y: 0, x: 648 },
      { y: 0, x: 652 },
    ],
  };

  const positions = startPositions[binNumber];
  if (!positions || positions.length === 0) return null;

  const randomIndex = Math.floor(Math.random() * positions.length);
  return positions[randomIndex];
}

export default function PlinkoBoard({
  rows = 16,
  path = [],
  isPlaying = false,
  onAnimationComplete,
  multipliers,
  riskMode = "medium",
  onAddBall,
  ballId = 0,
  resultBin = 9,
}: PlinkoBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);

  const cleanupPhysicsWorld = () => {
    if (renderRef.current) Matter.Render.stop(renderRef.current);
    if (engineRef.current) Matter.Engine.clear(engineRef.current);
    if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
  };

  const createPhysicsWorld = () => {
    const engine = Matter.Engine.create();
    engine.gravity.y = 0.6;
    engineRef.current = engine;

    const render = Matter.Render.create({
      canvas: canvasRef.current!,
      engine,
      options: {
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        wireframes: false,
        background: "transparent",
      },
    });

    const mainCategory = 0xffff;

    Matter.Render.lookAt(render, {
      min: { x: 0, y: 0 },
      max: { x: DESIGN_WIDTH, y: DESIGN_HEIGHT },
    });

    Matter.Events.on(engine, "collisionStart", (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;

        const pinBody = [bodyA, bodyB].find((b) => b.label === "pin");
        if (pinBody) {
          const { x, y } = pinBody.position;
          spawnHighlightEffect(x, y);
        }
      });
    });

    renderRef.current = render;
    Matter.Render.run(render);

    const runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);

    runnerRef.current = runner;
    const world = engine.world;

    // Walls (virtual space)
    Matter.Composite.add(world, [
      Matter.Bodies.rectangle(0, DESIGN_HEIGHT / 2, 10, DESIGN_HEIGHT, {
        isStatic: true,
        render: { fillStyle: "#1f2937" },
        collisionFilter: {
          category: mainCategory,
        },
      }),
      Matter.Bodies.rectangle(
        DESIGN_WIDTH,
        DESIGN_HEIGHT / 2,
        10,
        DESIGN_HEIGHT,
        {
          isStatic: true,
          render: { fillStyle: "#1f2937" },
          collisionFilter: {
            category: mainCategory,
          },
        }
      ),
      Matter.Bodies.rectangle(
        DESIGN_WIDTH / 2,
        DESIGN_HEIGHT,
        DESIGN_WIDTH,
        10,
        {
          isStatic: true,
          render: { fillStyle: "#1f2937" },
          collisionFilter: {
            category: mainCategory,
          },
        }
      ),
    ]);

    // Dividers
    const binCount = multipliers.length;
    const binWidth = DESIGN_WIDTH / binCount;
    for (let i = 1; i < binCount; i++) {
      Matter.Composite.add(
        world,
        Matter.Bodies.rectangle(i * binWidth, DESIGN_HEIGHT - 30, 3, 60, {
          isStatic: true,
          render: { fillStyle: "#1f2937" },
          collisionFilter: {
            category: mainCategory,
          },
        })
      );
    }

    // Pins (All Virtual)
    const pinSize = 6;
    const topPins = 3;
    const bottomPins = rows + 2;
    const pinsIncrement = (bottomPins - topPins) / (rows - 1);
    const verticalSpacing = (DESIGN_HEIGHT - 120) / (rows + 1);

    for (let row = 0; row < rows; row++) {
      const rowPins = Math.round(topPins + pinsIncrement * row);
      const spacing = DESIGN_WIDTH / (bottomPins + 1);
      const offsetY = 60 + row * verticalSpacing;
      const startX = (DESIGN_WIDTH - (rowPins - 1) * spacing) / 2;

      for (let i = 0; i < rowPins; i++) {
        const pin = Matter.Bodies.circle(
          startX + i * spacing,
          offsetY,
          pinSize,
          {
            isStatic: true,
            render: { fillStyle: "#ffffff" },
            restitution: 0.4,
            collisionFilter: {
              category: mainCategory,
            },
            label: "pin",
          }
        );
        Matter.Composite.add(world, pin);
      }
    }
  };

  function spawnHighlightEffect(x: number, y: number) {
  const effect = Matter.Bodies.circle(x, y, 6, {
    isStatic: true,
    render: {
      fillStyle: "rgba(255, 255, 255, 0.3)",
    },
    collisionFilter: {
      category: 0x0004, // eigene Kategorie
      mask: 0,          // mit nichts kollidieren
    },
    label: "pinEffect",
  });

  Matter.Composite.add(engineRef.current!.world, effect);

  // Animationsschritte (z. B. größer werdender Effekt)
  let scaleStep = 1.0;
  const maxScale = 2.0;
  const interval = setInterval(() => {
    scaleStep += 0.1;
    if (scaleStep >= maxScale) {
      clearInterval(interval);
      Matter.Composite.remove(engineRef.current!.world, effect);
    } else {
      Matter.Body.scale(effect, 1.1, 1.1);
      effect.render.fillStyle = `rgba(255, 255, 255, ${1 - (scaleStep - 1)})`; // wird transparenter
    }
  }, 50); // alle 50ms
}


  const createBall = useCallback(() => {
    if (!engineRef.current) return;
    if (!resultBin) return;

    console.log("Creating ball with ID:", ballId);
    console.log("Ball should go to bin:", resultBin);

    const ballSize = 6;
    const ballCategory = 0x0002;
    const ballColors = ["#22ff88", "#ff6622", "#2288ff", "#ffdd22", "#ff22dd"];
    const startPos = getRandomStartPositionForBin(resultBin);

    const ball = Matter.Bodies.circle(
      startPos?.x || 500,
      startPos?.y || 0,
      ballSize,
      {
        restitution: 0.4,
        friction: 0.01,
        frictionAir: 0.001,
        density: 0.02,
        render: {
          fillStyle: ballColors[Math.floor(Math.random() * ballColors.length)],
          visible: true,
        },
        collisionFilter: {
          category: ballCategory,
          mask: ~ballCategory,
        },
      }
    );
    Matter.Composite.add(engineRef.current.world, ball);
  }, [resultBin]);

  useEffect(() => {
    createPhysicsWorld();
    const resizeHandler = () => {
      cleanupPhysicsWorld();
      createPhysicsWorld();
    };
    window.addEventListener("resize", resizeHandler);
    return () => {
      cleanupPhysicsWorld();
      window.removeEventListener("resize", resizeHandler);
    };
  }, []);

  useEffect(() => {
    if (isPlaying && resultBin) {
      // Clean up old balls first to maintain performance
      // cleanupCompletedBalls();
      console.log("Creating new ball from ballId change:", ballId);
      createBall();
    }
  }, [isPlaying, resultBin, ballId, createBall]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden rounded-b-lg"
    >
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Multiplier Display */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between">
        {multipliers.map((multiplier, index) => {
          let bgColor = "bg-blue-500";
          if (multiplier >= 10) bgColor = "bg-red-500";
          else if (multiplier >= 3) bgColor = "bg-orange-500";
          else if (multiplier >= 1) bgColor = "bg-yellow-500";
          else if (multiplier >= 0.5) bgColor = "bg-green-500";
          else bgColor = "bg-purple-500";

          return (
            <div
              key={index}
              className={`text-xs md:text-sm px-1 py-1 ${bgColor} text-white rounded flex items-center justify-center`}
              style={{
                width: `${100 / multipliers.length}%`,
                fontSize: multipliers.length > 15 ? "0.65rem" : undefined,
                fontWeight: "bold",
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
