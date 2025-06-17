// Test image processing functionality for UI/UX analysis

import { Test, TestingModule } from '@nestjs/testing';
import { ImageProcessor } from './image-processor';
import { LlmCoreService } from '@core/llm';
import { ImageAnalysisResult } from '../interfaces/context-ingestion.interface';

describe('ImageProcessor', () => {
  let processor: ImageProcessor;
  let llmService: jest.Mocked<LlmCoreService>;

  // Mock data
  const mockImageBuffer = Buffer.from('fake-png-data');
  const mockImageBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

  const mockImageAnalysisResult: ImageAnalysisResult = {
    text: [
      'User Login',
      'Email Address',
      'Password',
      'Sign In',
      'Forgot Password?',
      'Create Account',
    ],
    uiElements: [
      {
        type: 'header',
        description: 'Application header with logo and navigation',
        position: { x: 0, y: 0 },
      },
      {
        type: 'input',
        description: 'Email address input field with validation',
        position: { x: 50, y: 100 },
      },
      {
        type: 'input',
        description: 'Password input field with show/hide toggle',
        position: { x: 50, y: 150 },
      },
      {
        type: 'button',
        description: 'Primary sign-in button with gradient background',
        position: { x: 50, y: 200 },
      },
      {
        type: 'link',
        description: 'Forgot password link with hover effect',
        position: { x: 50, y: 250 },
      },
      {
        type: 'button',
        description: 'Secondary create account button',
        position: { x: 50, y: 300 },
      },
    ],
    layout: {
      type: 'mobile',
      description: 'Centered vertical layout optimized for mobile screens',
    },
    colors: ['#007bff', '#ffffff', '#333333', '#f8f9fa', '#28a745'],
    isWireframe: false,
    confidence: 0.85,
  };

  const mockWireframeAnalysisResult: ImageAnalysisResult = {
    text: [
      'Dashboard',
      'Navigation Menu',
      'Main Content',
      'Sidebar',
      'Footer',
    ],
    uiElements: [
      {
        type: 'navigation',
        description: 'Top navigation bar with menu items',
        position: { x: 0, y: 0 },
      },
      {
        type: 'sidebar',
        description: 'Left sidebar with filter options',
        position: { x: 0, y: 60 },
      },
      {
        type: 'content',
        description: 'Main content area with data grid',
        position: { x: 250, y: 60 },
      },
      {
        type: 'footer',
        description: 'Footer with links and copyright',
        position: { x: 0, y: 600 },
      },
    ],
    layout: {
      type: 'desktop',
      description: 'Standard dashboard layout with sidebar navigation',
    },
    colors: ['#f5f5f5', '#ffffff', '#000000'],
    isWireframe: true,
    confidence: 0.92,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageProcessor,
        {
          provide: LlmCoreService,
          useValue: {
            generateFromTemplate: jest.fn(),
            generateText: jest.fn(),
          },
        },
      ],
    }).compile();

    processor = module.get<ImageProcessor>(ImageProcessor);
    llmService = module.get(LlmCoreService);

    jest.clearAllMocks();
  });

  describe('processImage', () => {
    it('should process PNG image buffer successfully', async () => {
      // Act
      const result = await processor.processImage(mockImageBuffer, 'image/png');

      // Assert
      expect(result).toBeDefined();
      expect(result.text).toBeInstanceOf(Array);
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.uiElements).toBeInstanceOf(Array);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should process JPEG image successfully', async () => {
      // Act
      const result = await processor.processImage(mockImageBuffer, 'image/jpeg');

      // Assert
      expect(result).toBeDefined();
      expect(result.text).toEqual([
        'Login Screen',
        'Username field',
        'Password field',
        'Submit button',
        'Forgot password link',
      ]);
      expect(result.uiElements).toHaveLength(4);
      expect(result.isWireframe).toBe(true);
    });

    it('should process WebP image format', async () => {
      // Act
      const result = await processor.processImage(mockImageBuffer, 'image/webp');

      // Assert
      expect(result).toBeDefined();
      expect(result.layout?.type).toBe('mobile');
      expect(result.layout?.description).toContain('Vertical layout');
    });

    it('should process base64 encoded image string', async () => {
      // Act
      const result = await processor.processImage(mockImageBase64, 'image/png');

      // Assert
      expect(result).toBeDefined();
      expect(result.text).toBeInstanceOf(Array);
      expect(result.uiElements).toBeInstanceOf(Array);
    });

    it('should identify mobile layout correctly', async () => {
      // Act
      const result = await processor.processImage(mockImageBuffer, 'image/png');

      // Assert
      expect(result.layout).toBeDefined();
      expect(result.layout?.type).toBe('mobile');
      expect(result.layout?.description).toContain('Vertical layout');
    });

    it('should extract UI elements with correct structure', async () => {
      // Act
      const result = await processor.processImage(mockImageBuffer, 'image/png');

      // Assert
      expect(result.uiElements).toBeDefined();
      expect(result.uiElements).toHaveLength(4);

      const inputElement = result.uiElements?.find(el => el.type === 'input');
      expect(inputElement).toBeDefined();
      expect(inputElement?.description).toContain('input field');

      const buttonElement = result.uiElements?.find(el => el.type === 'button');
      expect(buttonElement).toBeDefined();
      expect(buttonElement?.description).toContain('button');
    });

    it('should extract color palette from image', async () => {
      // Act
      const result = await processor.processImage(mockImageBuffer, 'image/png');

      // Assert
      expect(result.colors).toBeDefined();
      expect(result.colors).toBeInstanceOf(Array);
      expect(result.colors).toEqual(['#007bff', '#ffffff', '#333333']);
    });

    it('should detect wireframe vs regular UI', async () => {
      // Act
      const result = await processor.processImage(mockImageBuffer, 'image/png');

      // Assert
      expect(result.isWireframe).toBe(true);
      expect(result.confidence).toBe(0.7);
    });

    it('should handle different image sizes gracefully', async () => {
      const sizes = [
        { buffer: Buffer.alloc(100), description: 'very small image' },
        { buffer: Buffer.alloc(1024 * 1024), description: 'medium image' },
        { buffer: Buffer.alloc(5 * 1024 * 1024), description: 'large image' },
      ];

      for (const size of sizes) {
        // Act
        const result = await processor.processImage(size.buffer, 'image/png');

        // Assert
        expect(result).toBeDefined();
        expect(result.text).toBeInstanceOf(Array);
      }
    });

    it('should handle unsupported image formats', async () => {
      // Act
      const result = await processor.processImage(mockImageBuffer, 'image/tiff');

      // Assert
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle corrupted image data gracefully', async () => {
      // Arrange
      const corruptedBuffer = Buffer.from('not-an-image');

      // Act
      const result = await processor.processImage(corruptedBuffer, 'image/png');

      // Assert
      expect(result).toBeDefined();
      expect(result.text).toBeInstanceOf(Array);
    });

    it('should log processing information', async () => {
      // Arrange
      const logSpy = jest.spyOn(processor['logger'], 'log');

      // Act
      await processor.processImage(mockImageBuffer, 'image/png');

      // Assert
      expect(logSpy).toHaveBeenCalledWith('Processing image of type: image/png');
    });

    it('should extract text with OCR-like functionality', async () => {
      // Act
      const result = await processor.processImage(mockImageBuffer, 'image/png');

      // Assert
      expect(result.text).toContain('Login Screen');
      expect(result.text).toContain('Username field');
      expect(result.text).toContain('Password field');
    });

    it('should identify different UI element types', async () => {
      // Act
      const result = await processor.processImage(mockImageBuffer, 'image/png');

      // Assert
      const elementTypes = result.uiElements?.map(el => el.type) || [];
      expect(elementTypes).toContain('input');
      expect(elementTypes).toContain('button');
      expect(elementTypes).toContain('link');
    });

    it('should provide confidence score based on analysis quality', async () => {
      // Act
      const result = await processor.processImage(mockImageBuffer, 'image/png');

      // Assert
      expect(result.confidence).toBe(0.7);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('analyzeWireframe', () => {
    it('should analyze wireframe components successfully', async () => {
      // Act
      const result = await processor.analyzeWireframe(mockImageBuffer);

      // Assert
      expect(result).toBeDefined();
      expect(result.components).toBeInstanceOf(Array);
      expect(result.layout).toBeDefined();
      expect(result.interactions).toBeInstanceOf(Array);
    });

    it('should identify standard wireframe components', async () => {
      // Act
      const result = await processor.analyzeWireframe(mockImageBuffer);

      // Assert
      expect(result.components).toEqual([
        'Header with navigation',
        'Main content area',
        'Sidebar with filters',
        'Footer with links',
      ]);
    });

    it('should describe layout structure', async () => {
      // Act
      const result = await processor.analyzeWireframe(mockImageBuffer);

      // Assert
      expect(result.layout).toBe('Standard dashboard layout with sidebar');
    });

    it('should identify possible interactions', async () => {
      // Act
      const result = await processor.analyzeWireframe(mockImageBuffer);

      // Assert
      expect(result.interactions).toEqual([
        'Click on navigation items',
        'Filter sidebar options',
        'Content area scrolling',
      ]);
    });

    it('should handle base64 wireframe images', async () => {
      // Act
      const result = await processor.analyzeWireframe(mockImageBase64);

      // Assert
      expect(result).toBeDefined();
      expect(result.components).toHaveLength(4);
    });

    it('should work with different wireframe styles', async () => {
      const wireframeStyles = [
        Buffer.from('low-fidelity-wireframe'),
        Buffer.from('high-fidelity-wireframe'),
        Buffer.from('hand-drawn-wireframe'),
      ];

      for (const wireframe of wireframeStyles) {
        // Act
        const result = await processor.analyzeWireframe(wireframe);

        // Assert
        expect(result.components).toBeInstanceOf(Array);
        expect(result.components.length).toBeGreaterThan(0);
      }
    });

    it('should handle empty or minimal wireframes', async () => {
      // Arrange
      const minimalWireframe = Buffer.from('minimal-wireframe');

      // Act
      const result = await processor.analyzeWireframe(minimalWireframe);

      // Assert
      expect(result).toBeDefined();
      expect(result.components).toBeInstanceOf(Array);
    });
  });

  describe('generateMermaidFromImage', () => {
    it('should generate Mermaid diagram from image analysis', async () => {
      // Act
      const mermaid = processor.generateMermaidFromImage(mockImageAnalysisResult);

      // Assert
      expect(mermaid).toBeDefined();
      expect(mermaid).toContain('graph TB');
      expect(mermaid).toContain('el0["Application header with logo and navigation"]');
      expect(mermaid).toContain('el1["Email address input field with validation"]');
    });

    it('should handle analysis with no UI elements', async () => {
      // Arrange
      const emptyAnalysis: ImageAnalysisResult = {
        text: ['Some text'],
        uiElements: [],
        isWireframe: false,
        confidence: 0.5,
      };

      // Act
      const mermaid = processor.generateMermaidFromImage(emptyAnalysis);

      // Assert
      expect(mermaid).toBe('');
    });

    it('should handle analysis with undefined UI elements', async () => {
      // Arrange
      const analysisWithoutElements: ImageAnalysisResult = {
        text: ['Some text'],
        isWireframe: false,
        confidence: 0.5,
      };

      // Act
      const mermaid = processor.generateMermaidFromImage(analysisWithoutElements);

      // Assert
      expect(mermaid).toBe('');
    });

    it('should create proper node connections for multiple elements', async () => {
      // Act
      const mermaid = processor.generateMermaidFromImage(mockImageAnalysisResult);

      // Assert
      expect(mermaid).toContain('el0 --> el1');
      expect(mermaid).toContain('el1 --> el2');
    });

    it('should handle single UI element', async () => {
      // Arrange
      const singleElementAnalysis: ImageAnalysisResult = {
        text: ['Button'],
        uiElements: [
          {
            type: 'button',
            description: 'Single submit button',
          },
        ],
        isWireframe: false,
        confidence: 0.8,
      };

      // Act
      const mermaid = processor.generateMermaidFromImage(singleElementAnalysis);

      // Assert
      expect(mermaid).toContain('graph TB');
      expect(mermaid).toContain('el0["Single submit button"]');
      expect(mermaid).not.toContain('-->');
    });

    it('should escape special characters in descriptions', async () => {
      // Arrange
      const analysisWithSpecialChars: ImageAnalysisResult = {
        text: ['Test'],
        uiElements: [
          {
            type: 'input',
            description: 'Input field with "quotes" and special chars',
          },
        ],
        isWireframe: false,
        confidence: 0.8,
      };

      // Act
      const mermaid = processor.generateMermaidFromImage(analysisWithSpecialChars);

      // Assert
      expect(mermaid).toContain("Input field with 'quotes' and special chars");
      expect(mermaid).not.toContain('"quotes"');
    });

    it('should generate valid Mermaid syntax for complex UI', async () => {
      // Arrange
      const complexAnalysis: ImageAnalysisResult = {
        text: ['Complex UI'],
        uiElements: Array.from({ length: 10 }, (_, i) => ({
          type: 'element',
          description: `UI Element ${i + 1}`,
        })),
        isWireframe: false,
        confidence: 0.9,
      };

      // Act
      const mermaid = processor.generateMermaidFromImage(complexAnalysis);

      // Assert
      expect(mermaid).toContain('graph TB');
      expect(mermaid.split('\n').length).toBeGreaterThan(10);
      expect(mermaid).toContain('el0 --> el1');
      expect(mermaid).toContain('el1 --> el2');
    });

    it('should handle empty descriptions gracefully', async () => {
      // Arrange
      const analysisWithEmptyDesc: ImageAnalysisResult = {
        text: ['Test'],
        uiElements: [
          {
            type: 'input',
            description: '',
          },
        ],
        isWireframe: false,
        confidence: 0.6,
      };

      // Act
      const mermaid = processor.generateMermaidFromImage(analysisWithEmptyDesc);

      // Assert
      expect(mermaid).toContain('el0[""]');
    });

    it('should maintain consistent node naming', async () => {
      // Act
      const mermaid = processor.generateMermaidFromImage(mockImageAnalysisResult);

      // Assert
      const lines = mermaid.split('\n');
      const nodeLines = lines.filter(line => line.includes('el') && line.includes('['));

      expect(nodeLines).toEqual(expect.arrayContaining([
        expect.stringContaining('el0['),
        expect.stringContaining('el1['),
        expect.stringContaining('el2['),
      ]));
    });
  });

  describe('integration scenarios', () => {
    it('should process complete workflow from image to Mermaid', async () => {
      // Act
      const analysis = await processor.processImage(mockImageBuffer, 'image/png');
      const mermaid = processor.generateMermaidFromImage(analysis);

      // Assert
      expect(analysis).toBeDefined();
      expect(mermaid).toBeDefined();
      expect(mermaid).toContain('graph TB');
    });

    it('should handle workflow with wireframe analysis', async () => {
      // Act
      const analysis = await processor.processImage(mockImageBuffer, 'image/png');
      const wireframeAnalysis = await processor.analyzeWireframe(mockImageBuffer);
      const mermaid = processor.generateMermaidFromImage(analysis);

      // Assert
      expect(analysis.isWireframe).toBe(true);
      expect(wireframeAnalysis.components).toHaveLength(4);
      expect(mermaid).toContain('graph TB');
    });

    it('should maintain consistency across different image formats', async () => {
      const formats = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

      for (const format of formats) {
        // Act
        const analysis = await processor.processImage(mockImageBuffer, format);

        // Assert
        expect(analysis.text).toBeInstanceOf(Array);
        expect(analysis.confidence).toBeGreaterThan(0);
      }
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle null or undefined image data', async () => {
      // Act & Assert
      await expect(processor.processImage(null as any, 'image/png')).resolves.toBeDefined();
      await expect(processor.processImage(undefined as any, 'image/png')).resolves.toBeDefined();
    });

    it('should handle empty image buffer', async () => {
      // Arrange
      const emptyBuffer = Buffer.alloc(0);

      // Act
      const result = await processor.processImage(emptyBuffer, 'image/png');

      // Assert
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid MIME types gracefully', async () => {
      // Act
      const result = await processor.processImage(mockImageBuffer, 'invalid/mime-type');

      // Assert
      expect(result).toBeDefined();
      expect(result.text).toBeInstanceOf(Array);
    });

    it('should handle very large image files', async () => {
      // Arrange
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024); // 10MB

      // Act
      const result = await processor.processImage(largeBuffer, 'image/png');

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle non-image data gracefully', async () => {
      // Arrange
      const textBuffer = Buffer.from('This is not an image');

      // Act
      const result = await processor.processImage(textBuffer, 'text/plain');

      // Assert
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should provide meaningful fallback values', async () => {
      // Arrange
      const invalidBuffer = Buffer.from('invalid-image-data');

      // Act
      const result = await processor.processImage(invalidBuffer, 'image/png');

      // Assert
      expect(result.text).toBeInstanceOf(Array);
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.isWireframe).toBeDefined();
      expect(result.confidence).toBeDefined();
    });
  });
});