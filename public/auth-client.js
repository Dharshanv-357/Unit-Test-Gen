(function() {
  const token = localStorage.getItem('teacher_token');
  const isLoginPage = window.location.pathname.endsWith('login.html');

  if (!token && !isLoginPage) {
    window.location.href = '/login.html';
    return;
  }

  // Intercept all fetches to automatically append Authorization header
  const originalFetch = window.fetch;
  window.fetch = function(url, options = {}) {
    const activeToken = localStorage.getItem('teacher_token');
    
    // Only intercept local API endpoints that need authentication
    const urlString = typeof url === 'string' ? url : (url.url || '');
    if (activeToken && (urlString.startsWith('/api/') || urlString.includes('/api/'))) {
      options.headers = options.headers || {};
      if (options.headers instanceof Headers) {
        options.headers.set('Authorization', `Bearer ${activeToken}`);
      } else if (Array.isArray(options.headers)) {
        options.headers.push(['Authorization', `Bearer ${activeToken}`]);
      } else {
        options.headers['Authorization'] = `Bearer ${activeToken}`;
      }
    }

    return originalFetch(url, options).then((response) => {
      // If we get an unauthorized error from a protected route, redirect to login
      if (response.status === 401 && !window.location.pathname.endsWith('login.html')) {
        localStorage.removeItem('teacher_token');
        window.location.href = '/login.html';
      }
      return response;
    });
  };
})();
