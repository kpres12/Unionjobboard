import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import HaymarketLogo from './HaymarketLogo'
import LoginDialog from './LoginDialog'
import { canPost, canSeek } from '../utils/roles'

export default function Layout() {
  const { user, logout } = useAuth()

  const showDashboard = user && (canSeek(user) || canPost(user))

  return (
    <div className="flex min-h-screen flex-col bg-amber-50">
      <header className="bg-primary py-6 text-primary-foreground">
        <div className="container mx-auto flex items-center justify-between px-4">
          <HaymarketLogo className="text-primary-foreground" />
          <nav className="flex items-center gap-4 md:gap-6">
            <ul className="hidden space-x-6 md:flex">
              <li>
                <Link to="/about" className="text-lg hover:underline">
                  About
                </Link>
              </li>
              {canPost(user) && (
                <li>
                  <Link to="/post-job" className="text-lg hover:underline">
                    Post a Job
                  </Link>
                </li>
              )}
              <li>
                <Link to="/resources" className="text-lg hover:underline">
                  Resources
                </Link>
              </li>
              {showDashboard && (
                <li>
                  <Link to="/dashboard" className="text-lg hover:underline">
                    Dashboard
                  </Link>
                </li>
              )}
              {user?.isAdmin && (
                <li>
                  <Link to="/admin" className="text-lg hover:underline">
                    Admin
                  </Link>
                </li>
              )}
            </ul>
            {user ? (
              <div className="flex items-center gap-3">
                <Link to="/account" className="hidden text-sm hover:underline sm:inline">
                  {user.name}
                </Link>
                <button
                  onClick={logout}
                  className="rounded-md border border-secondary bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/90"
                >
                  Logout
                </button>
              </div>
            ) : (
              <LoginDialog />
            )}
          </nav>
        </div>
      </header>

      <main className="container mx-auto flex-grow px-4 py-12">
        <Outlet />
      </main>

      <footer className="bg-muted py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            &copy; {new Date().getFullYear()} Haymarket. All rights reserved.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-6">
            <Link to="/about" className="text-muted-foreground hover:text-primary">
              About
            </Link>
            <Link to="/resources" className="text-muted-foreground hover:text-primary">
              Resources
            </Link>
            {showDashboard && (
              <Link to="/dashboard" className="text-muted-foreground hover:text-primary">
                Dashboard
              </Link>
            )}
            <a href="mailto:hello@haymarket.jobs" className="text-muted-foreground hover:text-primary">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
