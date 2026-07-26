// scribble.ts

// The 'self' keyword references the global scope of the worker
self.onmessage = (event: MessageEvent<Uint8Array>) => {
  const array = event.data;
  
  // Simulate heavy computation
  const result = process(array);
  
  // Send data back to the main thread
  self.postMessage(result);
};

function process(chunk: Uint8Array): string {
    return btoa(String.fromCodePoint(...chunk));
}

// Export empty object to satisfy TypeScript module compilation
export {};
