import { FC } from 'react';
import { ArrowLink, Container } from '../components/ui';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const NotFound: FC = () => {
  useDocumentTitle('Page Not Found | BetterGovPH Status');
  return (
    <Container narrow className="py-16 text-center">
      <h1 className="font-serif-ed text-3xl font-bold text-ed-ink">
        Page Not Found
      </h1>
      <p className="mt-2 font-sans-ed text-sm text-ed-ink-3">
        The page you requested does not exist.
      </p>
      <div className="mt-6">
        <ArrowLink to="/">Return to status overview</ArrowLink>
      </div>
    </Container>
  );
};

export default NotFound;
