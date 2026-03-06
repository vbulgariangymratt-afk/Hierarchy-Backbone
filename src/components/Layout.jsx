import React from 'react';
import { Outlet } from 'react-router-dom';

function Layout({ children }) {
    return (
        <div className="app-layout">
            {children || <Outlet />}
        </div>
    );
}

export default Layout;
