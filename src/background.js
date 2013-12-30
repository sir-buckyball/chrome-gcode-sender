// Open a window when launched.
chrome.app.runtime.onLaunched.addListener(function() { 
  chrome.app.window.create('main.html', {
    bounds: {
      width: 1024,
      height: 768,
    },
    minWidth: 320,
    minHeight: 320
  });
});

// TODO: cleanup?
chrome.runtime.onSuspend.addListener(function() { 
});
