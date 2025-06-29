'use client';

import { StickyHeader } from '@/components/landing/StickyHeader';

export default function TestContrastPage() {
  return (
    <div className="min-h-screen">
      <StickyHeader />
      
      {/* Test Section 1: Light Background */}
      <section className="h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Light Background</h1>
          <p className="text-gray-600 max-w-md">
            Header text should be dark on this light background for optimal contrast.
            Scroll down to test different background scenarios.
          </p>
        </div>
      </section>

      {/* Test Section 2: Dark Background */}
      <section className="h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Dark Background</h1>
          <p className="text-gray-300 max-w-md">
            Header text should be light/white on this dark background for optimal contrast.
          </p>
        </div>
      </section>

      {/* Test Section 3: Medium Gray Background */}
      <section className="h-screen bg-gray-500 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Medium Gray Background</h1>
          <p className="text-gray-100 max-w-md">
            Header text should adapt based on contrast calculation.
            This tests the algorithm's decision-making for mid-tone backgrounds.
          </p>
        </div>
      </section>

      {/* Test Section 4: PhotoAI Gradient Background */}
      <section className="h-screen bg-photoai-gradient flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">PhotoAI Gradient</h1>
          <p className="text-gray-100 max-w-md">
            Testing with the PhotoAI brand gradient.
            Header should use appropriate contrast for the sampled gradient colors.
          </p>
        </div>
      </section>

      {/* Test Section 5: Blue Background */}
      <section className="h-screen bg-blue-600 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Blue Background</h1>
          <p className="text-blue-100 max-w-md">
            Testing colored background. Header text should maintain readability.
          </p>
        </div>
      </section>

      {/* Test Section 6: Red Background */}
      <section className="h-screen bg-red-600 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Red Background</h1>
          <p className="text-red-100 max-w-md">
            Another colored background test for contrast algorithm validation.
          </p>
        </div>
      </section>

      {/* Test Section 7: Yellow Background */}
      <section className="h-screen bg-yellow-400 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Yellow Background</h1>
          <p className="text-gray-800 max-w-md">
            Bright yellow background - header text should be dark for contrast.
          </p>
        </div>
      </section>

      {/* Test Section 8: Purple Background */}
      <section className="h-screen bg-purple-700 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Purple Background</h1>
          <p className="text-purple-100 max-w-md">
            Deep purple background - testing with PhotoAI accent colors.
          </p>
        </div>
      </section>

      {/* Test Section 9: Cyan Background */}
      <section className="h-screen bg-cyan-400 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Cyan Background</h1>
          <p className="text-gray-800 max-w-md">
            Bright cyan background similar to PhotoAI accent color.
          </p>
        </div>
      </section>

      {/* Test Section 10: Complex Gradient */}
      <section className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Complex Gradient</h1>
          <p className="text-gray-200 max-w-md">
            Multi-color gradient background to test the color sampling algorithm's
            ability to average multiple colors and determine optimal contrast.
          </p>
        </div>
      </section>

      {/* Test Section 11: Image Background Simulation */}
      <section 
        className="h-screen flex items-center justify-center relative"
        style={{
          background: 'linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%239C92AC" fill-opacity="0.4"%3E%3Ccircle cx="30" cy="30" r="4"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
        }}
      >
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Image Background Simulation</h1>
          <p className="text-gray-200 max-w-md">
            Simulated image background with overlay.
            Tests the algorithm's ability to handle complex backgrounds.
          </p>
        </div>
      </section>

      {/* Test Section 12: Very Light Gray */}
      <section className="h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Very Light Gray</h1>
          <p className="text-gray-700 max-w-md">
            Testing edge case with very light background.
            Header should maintain dark text for readability.
          </p>
        </div>
      </section>

      {/* Test Section 13: Very Dark Gray */}
      <section className="h-screen bg-gray-800 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">Very Dark Gray</h1>
          <p className="text-gray-300 max-w-md">
            Testing edge case with very dark background.
            Header should use light text for optimal contrast.
          </p>
        </div>
      </section>

      {/* Final Test Section: Back to Light */}
      <section className="h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Final Test: Light Background</h1>
          <p className="text-gray-600 max-w-md">
            Returning to light background to test transition back to dark text.
            This validates the bidirectional color adaptation.
          </p>
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Test Instructions:</h2>
            <ul className="text-left text-sm space-y-1">
              <li>• Scroll slowly through each section</li>
              <li>• Observe header text color changes</li>
              <li>• Verify text remains readable on all backgrounds</li>
              <li>• Check smooth transitions between color modes</li>
              <li>• Test on different screen sizes and devices</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
} 