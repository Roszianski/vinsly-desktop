import '@testing-library/jest-dom';

// Mock devLogger to avoid import.meta.env issues in Jest
jest.mock('./utils/devLogger', () => ({
  devLog: {
    error: jest.fn(),
    warn: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
  },
}));
