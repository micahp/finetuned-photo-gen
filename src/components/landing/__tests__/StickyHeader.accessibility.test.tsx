import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { StickyHeader } from '../StickyHeader';
import { SessionProvider } from 'next-auth/react';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock Next.js components
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>;
  };
});

jest.mock('next/image', () => {
  return function MockImage({ src, alt, ...props }: any) {
    return <img src={src} alt={alt} {...props} />;
  };
});

// Mock next-auth
const mockSession = {
  user: {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    credits: 100
  },
  expires: '2024-12-31'
};

const MockSessionProvider = ({ children, session = null }: any) => (
  <SessionProvider session={session}>
    {children}
  </SessionProvider>
);

describe('StickyHeader Accessibility Tests', () => {
  beforeEach(() => {
    // Mock window and document for SSR compatibility
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      writable: true
    });
    
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      writable: true
    });

    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2000,
      writable: true
    });
  });

  describe('WCAG Compliance', () => {
    it('should not have any accessibility violations (unauthenticated)', async () => {
      const { container } = render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have any accessibility violations (authenticated)', async () => {
      const { container } = render(
        <MockSessionProvider session={mockSession}>
          <StickyHeader />
        </MockSessionProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Semantic HTML and ARIA', () => {
    it('should have proper banner role', () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('should have proper navigation landmarks', () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      const navElements = screen.getAllByRole('navigation');
      expect(navElements).toHaveLength(1); // Desktop nav only (mobile hidden by default)
      
      expect(screen.getByLabelText('Primary navigation')).toBeInTheDocument();
    });

    it('should have proper aria-labels for interactive elements', () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      expect(screen.getByLabelText('Fine Photo Gen - Home')).toBeInTheDocument();
      expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    });

    it('should have proper aria-expanded for mobile menu button', () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      const menuButton = screen.getByLabelText('Open menu');
      expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    });

    it('should update aria-expanded when mobile menu is opened', async () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      const menuButton = screen.getByLabelText('Open menu');
      fireEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Close menu')).toHaveAttribute('aria-expanded', 'true');
      });
    });

    it('should have proper aria-controls for mobile menu', () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      const menuButton = screen.getByLabelText('Open menu');
      expect(menuButton).toHaveAttribute('aria-controls', 'mobile-menu');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close mobile menu with Escape key', async () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      const menuButton = screen.getByLabelText('Open menu');
      fireEvent.click(menuButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Mobile navigation')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByLabelText('Mobile navigation')).not.toBeInTheDocument();
      });
    });

    it('should have focus indicators on interactive navigation elements', () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      // Check navigation links specifically (they have focus styles)
      const exploreLink = screen.getByText('Explore').closest('a');
      const createLink = screen.getByText('Create').closest('a');
      const menuButton = screen.getByLabelText('Open menu');

      expect(exploreLink?.className).toMatch(/focus:/);
      expect(createLink?.className).toMatch(/focus:/);
      expect(menuButton.className).toMatch(/focus:/);
    });
  });

  describe('Screen Reader Support', () => {
    it('should have descriptive alt text for logo', () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      const logo = screen.getByAltText('Fine Photo Gen Logo');
      expect(logo).toBeInTheDocument();
    });

    it('should have meaningful link text', () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      // Check that links have descriptive text, not generic "click here"
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        const linkText = link.textContent || '';
        expect(linkText.toLowerCase()).not.toMatch(/click here|read more|learn more/);
        expect(linkText.trim()).not.toBe('');
      });
    });

    it('should have title attributes for additional context', () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      const exploreLink = screen.getByText('Explore').closest('a');
      expect(exploreLink).toHaveAttribute('title', 'Browse AI-generated images');
    });
  });

  describe('Mobile Accessibility', () => {
    it('should have touch-friendly button sizes', () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      const menuButton = screen.getByLabelText('Open menu');
      
      // Check that the button has adequate padding (p-2 = 8px = 16px total)
      expect(menuButton.className).toMatch(/p-2/);
    });

    it('should prevent body scroll when mobile menu is open', async () => {
      const originalOverflow = document.body.style.overflow;
      
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      const menuButton = screen.getByLabelText('Open menu');
      fireEvent.click(menuButton);

      await waitFor(() => {
        expect(document.body.style.overflow).toBe('hidden');
      });

      // Cleanup
      document.body.style.overflow = originalOverflow;
    });
  });

  describe('SSR Compatibility', () => {
    it('should handle missing browser APIs gracefully', () => {
      // Mock missing document.elementFromPoint
      const originalElementFromPoint = document.elementFromPoint;
      delete (document as any).elementFromPoint;

      const { container } = render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      // Should render without throwing errors
      expect(container).toBeInTheDocument();

      // Restore original method
      document.elementFromPoint = originalElementFromPoint;
    });

    it('should render scroll progress indicator with proper SSR check', () => {
      render(
        <MockSessionProvider>
          <StickyHeader />
        </MockSessionProvider>
      );

      // Should find the progress indicator element
      const progressIndicator = document.querySelector('.bg-photoai-accent-cyan');
      expect(progressIndicator).toBeInTheDocument();
    });
  });
}); 