import React, { useEffect } from 'react';

const AuthCallback: React.FC = () => {
  useEffect(() => {
    const redirectPath = localStorage.getItem('authRedirectPath');
    localStorage.removeItem('authRedirectPath');

    if (redirectPath) {
      window.location.replace(redirectPath);
    } else {
      window.location.replace('/');
    }
  }, []);

  return (
    <div>
      <p>Redirecting...</p>
    </div>
  );
};

export default AuthCallback;