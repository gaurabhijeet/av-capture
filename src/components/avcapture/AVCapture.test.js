import { render, screen } from '@testing-library/react';
import AVCapture from './AVCapture';

test('renders learn react link', () => {
  render(<AVCapture />);
  const linkElement = screen.getByText(/learn react/i);
  expect(linkElement).toBeInTheDocument();
});
