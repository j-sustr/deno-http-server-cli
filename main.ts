import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { join } from "https://deno.land/std@0.224.0/path/mod.ts";

// Get the path to serve from command-line arguments
const servePath = Deno.args[0];

// Check if a path was provided
if (!servePath) {
  console.error("Usage: deno run --allow-net --allow-read server.ts <path_to_serve>");
  Deno.exit(1);
}

console.log(`Attempting to serve: ${servePath}`);

// Determine if the path is a file or a directory
let pathStat: Deno.FileInfo;
try {
  pathStat = await Deno.stat(servePath);
} catch (error) {
  if (error instanceof Deno.errors.NotFound) {
    console.error(`Error: Path not found - ${servePath}`);
  } else if (error instanceof Deno.errors.PermissionDenied) {
    console.error(`Error: Permission denied to access - ${servePath}. Ensure --allow-read is set.`);
  } else {
    console.error(`An unexpected error occurred: ${error.message}`);
  }
  Deno.exit(1);
}

const isDirectory = pathStat.isDirectory;
const isFile = pathStat.isFile;

// Start the HTTP server
const port = 8000;
console.log(`HTTP server listening on http://localhost:${port}/`);
console.log(`Serving ${isDirectory ? 'directory' : 'file'}: ${servePath}`);

serve(async (req) => {
  const url = new URL(req.url);
  let filePath = url.pathname;

  // Normalize the requested path
  if (filePath.startsWith('/')) {
    filePath = filePath.substring(1); // Remove leading slash
  }

  let fullPath: string;

  if (isDirectory) {
    // If serving a directory, join the requested path with the base directory
    fullPath = join(servePath, filePath);
    // If the request is for a directory (e.g., / or /subdir/), try to serve index.html
    try {
      const stat = await Deno.stat(fullPath);
      if (stat.isDirectory) {
        fullPath = join(fullPath, "index.html");
      }
    } catch (e) {
      // If stat fails (e.g., file not found), continue with the original fullPath
    }
  } else if (isFile) {
    // If serving a single file, ignore the requested path and always serve the specified file
    fullPath = servePath;
  } else {
    // Should not happen if pathStat was successful and it's neither dir nor file
    return new Response("Internal Server Error: Invalid serve path type", { status: 500 });
  }

  try {
    const file = await Deno.open(fullPath, { read: true });
    const readableStream = file.readable;
    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/html", // Basic content type, can be improved with mime types
      },
    });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.warn(`File not found: ${fullPath}`);
      return new Response("Not Found", { status: 404 });
    } else if (error instanceof Deno.errors.PermissionDenied) {
      console.error(`Permission denied to read: ${fullPath}`);
      return new Response("Permission Denied", { status: 403 });
    } else {
      console.error(`Error serving file ${fullPath}: ${error.message}`);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
}, { port });