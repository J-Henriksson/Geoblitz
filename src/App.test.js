import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the GeoBlitz home screen', () => {
  render(<App />);
  const heading = screen.getByText(/GeoBlitz/i);
  expect(heading).toBeInTheDocument();
});
