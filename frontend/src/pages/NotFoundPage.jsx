import { Link } from '@tanstack/react-router'

function NotFoundPage() {
  return (
    <section>
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <Link to="/">Return home</Link>
    </section>
  )
}

export default NotFoundPage
