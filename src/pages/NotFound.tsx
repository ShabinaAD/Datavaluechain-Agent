import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-6xl font-bold text-brand-600">404</p>
      <h1 className="mt-3 text-xl font-semibold text-content">Page not found</h1>
      <p className="mt-1 text-sm text-content-muted">
        That stage doesn’t exist in the value chain.
      </p>
      <Link to="/" className="mt-6">
        <Button>Back to overview</Button>
      </Link>
    </div>
  );
}
