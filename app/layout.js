
import "./globals.css";

import 'bootstrap/dist/css/bootstrap.min.css';




export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <div className="d-flex justify-content-end p-2">
          <a href="/api/auth/logout" className="btn btn-sm btn-outline-secondary">
            Cerrar sesión
          </a>
        </div>
        {children}
      </body>
    </html>
  );
}
