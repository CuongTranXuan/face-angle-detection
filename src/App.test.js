import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the unified face angle dashboard', () => {
  render(<App />);
  expect(screen.getByText(/Three ways to read a face/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Face API/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Haar cascade/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /BlazeFace/i })).toBeInTheDocument();
});
