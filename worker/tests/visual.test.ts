import { describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import {
  STANDARD_VIEWPORTS,
  getViewportProfile,
  VisualComparator,
  BaselineManager,
  LayoutShiftDetector,
} from '../src/visual';

function createSolidPngBuffer(width: number, height: number, r: number, g: number, b: number, a = 255): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

describe('Deterministic Visual & Responsive QA Unit Tests', () => {
  describe('Viewport Profiles', () => {
    it('should define standard viewports: desktop, tablet, and mobile', () => {
      expect(STANDARD_VIEWPORTS.DESKTOP.width).toBe(1440);
      expect(STANDARD_VIEWPORTS.DESKTOP.height).toBe(900);
      expect(STANDARD_VIEWPORTS.TABLET.width).toBe(768);
      expect(STANDARD_VIEWPORTS.TABLET.height).toBe(1024);
      expect(STANDARD_VIEWPORTS.MOBILE.width).toBe(390);
      expect(STANDARD_VIEWPORTS.MOBILE.height).toBe(844);
      expect(STANDARD_VIEWPORTS.MOBILE.isMobile).toBe(true);
    });

    it('should resolve viewport profile by name or width', () => {
      expect(getViewportProfile('desktop').name).toBe('desktop');
      expect(getViewportProfile('mobile').name).toBe('mobile');
      expect(getViewportProfile(1440).width).toBe(1440);
      expect(getViewportProfile(390).width).toBe(390);
      expect(getViewportProfile('custom-test').width).toBe(1280);
    });
  });

  describe('Visual Comparator', () => {
    const comparator = new VisualComparator();

    it('should report PASS (0 diff ratio) for identical images', () => {
      const buf1 = createSolidPngBuffer(100, 100, 15, 23, 42);
      const buf2 = createSolidPngBuffer(100, 100, 15, 23, 42);

      const result = comparator.compareBuffers(
        buf1,
        buf2,
        'http://localhost/test',
        STANDARD_VIEWPORTS.DESKTOP
      );

      expect(result.status).toBe('PASS');
      expect(result.changedPixelCount).toBe(0);
      expect(result.pixelDifferenceRatio).toBe(0);
      expect(result.boundingRegion).toBeUndefined();
      expect(result.diffBuffer).toBeDefined();
    });

    it('should report DIMENSION_MISMATCH when comparing different dimensions', () => {
      const buf1 = createSolidPngBuffer(100, 100, 15, 23, 42);
      const buf2 = createSolidPngBuffer(120, 100, 15, 23, 42);

      const result = comparator.compareBuffers(
        buf1,
        buf2,
        'http://localhost/test',
        STANDARD_VIEWPORTS.DESKTOP
      );

      expect(result.status).toBe('DIMENSION_MISMATCH');
      expect(result.pixelDifferenceRatio).toBe(1.0);
    });

    it('should report HIGH visual regression when >5% of pixels differ', () => {
      // 100x100 = 10,000 pixels. Changing 1000 pixels (10% diff)
      const png1 = new PNG({ width: 100, height: 100 });
      const png2 = new PNG({ width: 100, height: 100 });

      for (let i = 0; i < 100 * 100 * 4; i += 4) {
        png1.data[i] = 20;
        png1.data[i + 1] = 20;
        png1.data[i + 2] = 20;
        png1.data[i + 3] = 255;

        png2.data[i] = 20;
        png2.data[i + 1] = 20;
        png2.data[i + 2] = 20;
        png2.data[i + 3] = 255;
      }

      // Alter a 30x35 block (1050 pixels = 10.5% diff)
      for (let y = 10; y < 45; y++) {
        for (let x = 10; x < 40; x++) {
          const idx = (100 * y + x) << 2;
          png2.data[idx] = 255;
          png2.data[idx + 1] = 0;
          png2.data[idx + 2] = 0;
        }
      }

      const buf1 = PNG.sync.write(png1);
      const buf2 = PNG.sync.write(png2);

      const result = comparator.compareBuffers(
        buf1,
        buf2,
        'http://localhost/test',
        STANDARD_VIEWPORTS.DESKTOP
      );

      expect(result.status).toBe('HIGH');
      expect(result.changedPixelCount).toBe(1050);
      expect(result.pixelDifferenceRatio).toBeCloseTo(0.105, 2);
      expect(result.boundingRegion).toEqual({
        x: 10,
        y: 10,
        width: 30,
        height: 35,
      });
    });

    it('should report MEDIUM visual regression when 1% to 5% of pixels differ', () => {
      // 100x100 = 10,000 pixels. Alter a 15x20 block (300 pixels = 3% diff)
      const png1 = new PNG({ width: 100, height: 100 });
      const png2 = new PNG({ width: 100, height: 100 });

      for (let i = 0; i < 100 * 100 * 4; i += 4) {
        png1.data[i] = 20;
        png1.data[i + 1] = 20;
        png1.data[i + 2] = 20;
        png1.data[i + 3] = 255;

        png2.data[i] = 20;
        png2.data[i + 1] = 20;
        png2.data[i + 2] = 20;
        png2.data[i + 3] = 255;
      }

      for (let y = 10; y < 30; y++) {
        for (let x = 10; x < 25; x++) {
          const idx = (100 * y + x) << 2;
          png2.data[idx] = 255;
        }
      }

      const result = comparator.compareBuffers(
        PNG.sync.write(png1),
        PNG.sync.write(png2),
        'http://localhost/test',
        STANDARD_VIEWPORTS.DESKTOP
      );

      expect(result.status).toBe('MEDIUM');
      expect(result.pixelDifferenceRatio).toBeCloseTo(0.03, 2);
    });
  });

  describe('Baseline Manager', () => {
    it('should register and retrieve in-memory baseline snapshots', async () => {
      const manager = new BaselineManager();
      const mockSnapshot = {
        id: 'snap-1',
        testRunId: 'run-1',
        projectId: 'proj-1',
        pageUrl: 'http://localhost:3000/home',
        viewport: STANDARD_VIEWPORTS.DESKTOP,
        width: 1440,
        height: 900,
        capturedAt: new Date().toISOString(),
      };

      manager.registerInMemoryBaseline(mockSnapshot);

      const retrieved = await manager.getBaseline(
        null,
        'proj-1',
        'http://localhost:3000/home',
        STANDARD_VIEWPORTS.DESKTOP
      );

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('snap-1');
    });

    it('should return null when no baseline exists without crashing', async () => {
      const manager = new BaselineManager();
      const retrieved = await manager.getBaseline(
        null,
        'proj-2',
        'http://localhost:3000/unregistered',
        STANDARD_VIEWPORTS.MOBILE
      );

      expect(retrieved).toBeNull();
    });
  });

  describe('Layout Shift Detector', () => {
    it('should detect significant element displacement after interaction', () => {
      const detector = new LayoutShiftDetector();

      const before = [
        { selector: '#header', tagName: 'header', text: 'Main Header', x: 20, y: 50, width: 800, height: 60 },
        { selector: '#btn', tagName: 'button', text: 'Click Me', x: 20, y: 130, width: 120, height: 40 },
      ];

      const after = [
        { selector: '#header', tagName: 'header', text: 'Main Header', x: 20, y: 190, width: 800, height: 60 }, // Shifted by 140px down
        { selector: '#btn', tagName: 'button', text: 'Click Me', x: 20, y: 130, width: 120, height: 40 },
      ];

      const shifts = detector.detectShifts(
        before,
        after,
        STANDARD_VIEWPORTS.DESKTOP,
        'http://localhost/test',
        'click on #toggle'
      );

      expect(shifts.length).toBe(1);
      expect(shifts[0].type).toBe('LAYOUT_SHIFT');
      expect(shifts[0].shiftAmount).toBe(140);
      expect(shifts[0].selector).toBe('#header');
      expect(shifts[0].severity).toBe('medium');
    });

    it('should ignore sub-threshold minor movements (<40px)', () => {
      const detector = new LayoutShiftDetector();

      const before = [
        { selector: '#header', tagName: 'header', text: 'Main Header', x: 20, y: 50, width: 800, height: 60 },
      ];

      const after = [
        { selector: '#header', tagName: 'header', text: 'Main Header', x: 22, y: 55, width: 800, height: 60 }, // Shifted by ~6px
      ];

      const shifts = detector.detectShifts(
        before,
        after,
        STANDARD_VIEWPORTS.DESKTOP,
        'http://localhost/test'
      );

      expect(shifts.length).toBe(0);
    });
  });
});
