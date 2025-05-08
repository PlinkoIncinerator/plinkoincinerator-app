import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL } from '../../config/constants';

// Explicitly mark as dynamic to ensure the route isn't statically optimized
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// List of paths that should be excluded from proxying (handled by other routes)
const EXCLUDED_PATHS = ['socket'];


/**
 * This is a catch-all API route handler that forwards requests to the internal server
 */
export async function GET(req: NextRequest, context: any) {
  // Properly await params before using them
  const params = await Promise.resolve(context.params);
  const path = params?.path || [];
  
  // Skip excluded paths
  if (path.length > 0 && EXCLUDED_PATHS.includes(path[0])) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  return await proxyRequest(req, path);
}

export async function POST(req: NextRequest, context: any) {
  // Properly await params before using them
  const params = await Promise.resolve(context.params);
  const path = params?.path || [];
  
  // Skip excluded paths
  if (path.length > 0 && EXCLUDED_PATHS.includes(path[0])) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  
  return await proxyRequest(req, path);
}

export async function PUT(req: NextRequest, context: any) {
  // Properly await params before using them
  const params = await Promise.resolve(context.params);
  const path = params?.path || [];
  return await proxyRequest(req, path);
}

export async function DELETE(req: NextRequest, context: any) {
  // Properly await params before using them
  const params = await Promise.resolve(context.params);
  const path = params?.path || [];
  return await proxyRequest(req, path);
}

export async function PATCH(req: NextRequest, context: any) {
  // Properly await params before using them
  const params = await Promise.resolve(context.params);
  const path = params?.path || [];
  return await proxyRequest(req, path);
}

/**
 * Helper function to proxy requests to the internal server
 */
async function proxyRequest(req: NextRequest, path: string[]) {
  const INTERNAL_SERVER = API_BASE_URL;
  
  try {
    // Construct the target URL by combining the internal server URL with the requested path
    const url = new URL(req.url);
    const pathSegment = path.join('/');
    const queryParams = url.searchParams.toString();
    
    // Create the full target URL with query parameters
    const targetUrl = `${INTERNAL_SERVER}/api/${pathSegment}${queryParams ? `?${queryParams}` : ''}`;
    
    // Forward headers from the original request
    const requestHeaders = new Headers(req.headers);
    
    // Handle request body based on method and content type
    let bodyContent: ArrayBuffer | string | null = null;
    if (req.body && req.method !== 'GET' && req.method !== 'HEAD') {
      const contentType = req.headers.get('content-type') || '';
      
      if (contentType.includes('application/octet-stream')) {
        bodyContent = await req.arrayBuffer();
      } else if (contentType.includes('application/json')) {
        // For JSON, read as text and pass as is
        bodyContent = await req.text();
      } else if (contentType.includes('multipart/form-data')) {
        // For form data, clone the request and extract the body
        bodyContent = await req.arrayBuffer();
      } else {
        // For other types, read as text
        bodyContent = await req.text();
      }
    }
    
    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: requestHeaders,
      body: bodyContent || undefined
    };
    
    // Add the duplex option if supported in this environment
    // @ts-expect-error - The duplex option is required but not in the types
    if (typeof fetchOptions.duplex === 'undefined' && bodyContent) {
      // @ts-expect-error - The duplex option is required but not in the types
      fetchOptions.duplex = 'half';
    }
    
    // Forward request to the internal server
    const response = await fetch(targetUrl, fetchOptions);
    
    // Forward the response back to the client
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to internal server' },
      { status: 500 }
    );
  }
} 