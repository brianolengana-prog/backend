/**
 * Library Manager - Handles initialization and management of extraction libraries
 * Single Responsibility: Library lifecycle management
 */

class LibraryManager {
  constructor() {
    this.libraries = new Map();
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Initialize all required libraries
   */
  async initialize() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._loadLibraries();
    await this.initializationPromise;
    this.isInitialized = true;
    
    return this.initializationPromise;
  }

  async _loadLibraries() {
    const libraryConfigs = [
      { name: 'pdfjs', module: 'pdfjs-dist', required: true },
      { name: 'mammoth', module: 'mammoth', required: true },
      { name: 'xlsx', module: 'xlsx', required: true },
      { name: 'tesseract', module: 'tesseract.js', required: false },
      { name: 'pdf2pic', module: 'pdf2pic', required: false },
      { name: 'sharp', module: 'sharp', required: false }
    ];

    const loadPromises = libraryConfigs.map(async ({ name, module, required }) => {
      try {
        let lib;
        if (name === 'pdfjs') {
          // pdfjs-dist is ESM, so we need to use dynamic import
          const pdfjsModule = await import(module);
          lib = pdfjsModule.default || pdfjsModule;
        } else {
          lib = require(module);
        }
        this.libraries.set(name, lib);
        console.log(`✅ ${name} library loaded successfully`);
        return { name, success: true };
      } catch (error) {
        if (required) {
          console.error(`❌ Required library ${name} failed to load:`, error.message);
          throw new Error(`Required library ${name} not available: ${error.message}`);
        } else {
          console.warn(`⚠️ Optional library ${name} not available:`, error.message);
          return { name, success: false, error: error.message };
        }
      }
    });

    const results = await Promise.allSettled(loadPromises);
    const failures = results.filter(result => result.status === 'rejected');
    
    if (failures.length > 0) {
      console.error('❌ Some required libraries failed to load:', failures);
      throw new Error('Failed to load required extraction libraries');
    }

    console.log('✅ All extraction libraries initialized successfully');
  }

  /**
   * Get a library, loading it on-demand if needed
   */
  async getLibrary(libraryName, required = true) {
    if (this.libraries.has(libraryName)) {
      return this.libraries.get(libraryName);
    }

    if (this.initializationPromise && !this.isInitialized) {
      await this.initializationPromise;
      if (this.libraries.has(libraryName)) {
        return this.libraries.get(libraryName);
      }
    }

    try {
      const libraryConfigs = {
        pdfjs: 'pdfjs-dist',
        mammoth: 'mammoth',
        xlsx: 'xlsx',
        tesseract: 'tesseract.js',
        pdf2pic: 'pdf2pic',
        sharp: 'sharp'
      };

      const moduleName = libraryConfigs[libraryName];
      if (!moduleName) {
        throw new Error(`Unknown library: ${libraryName}`);
      }

      const lib = require(moduleName);
      this.libraries.set(libraryName, lib);
      console.log(`✅ ${libraryName} library loaded on-demand`);
      return lib;
    } catch (error) {
      const message = `${libraryName} processing library not available: ${error.message}`;
      if (required) {
        throw new Error(message);
      } else {
        console.warn(`⚠️ ${message}`);
        return null;
      }
    }
  }

  /**
   * Check if a library is available
   */
  hasLibrary(libraryName) {
    return this.libraries.has(libraryName);
  }

  /**
   * Get health status of all libraries
   */
  getHealthStatus() {
    return {
      initialized: this.isInitialized,
      libraries: {
        pdfjs: this.libraries.has('pdfjs'),
        mammoth: this.libraries.has('mammoth'),
        xlsx: this.libraries.has('xlsx'),
        tesseract: this.libraries.has('tesseract'),
        pdf2pic: this.libraries.has('pdf2pic'),
        sharp: this.libraries.has('sharp')
      }
    };
  }
}

module.exports = new LibraryManager();
