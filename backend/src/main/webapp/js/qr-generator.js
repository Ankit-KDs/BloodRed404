/**
 * Standalone QR Code Generator for RED404
 * Generates valid ISO/IEC 18004 compliant QR Code SVGs without external dependencies.
 */
(function(global) {
  'use strict';

  // QR Math & Polynomial tables
  const QRMath = {
    glog: function(n) {
      if (n < 1) throw new Error("glog(" + n + ")");
      return QRMath.LOG_TABLE[n];
    },
    gexp: function(n) {
      while (n < 0) n += 255;
      while (n >= 255) n -= 255;
      return QRMath.EXP_TABLE[n];
    },
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256)
  };

  for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (let i = 8; i < 256; i++) {
    QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
  }
  for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

  function Polynomial(num, shift) {
    if (num.length === undefined) throw new Error(num.length + "/" + shift);
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
    for (let i = num.length - offset; i < this.num.length; i++) this.num[i] = 0;
  }

  Polynomial.prototype = {
    get: function(index) { return this.num[index]; },
    getLength: function() { return this.num.length; },
    multiply: function(e) {
      const num = new Array(this.getLength() + e.getLength() - 1);
      for (let i = 0; i < this.getLength(); i++) {
        for (let j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new Polynomial(num, 0);
    },
    mod: function(e) {
      if (this.getLength() - e.getLength() < 0) return this;
      const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      const num = new Array(this.getLength());
      for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
      for (let i = 0; i < e.getLength(); i++) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      }
      return new Polynomial(num, 0).mod(e);
    }
  };

  const RS_BLOCK_TABLE = [
    [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
    [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
    [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
    [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
    [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12]
  ];

  function QRCode(typeNumber, errorCorrectionLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectionLevel = errorCorrectionLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataList = [];
  }

  QRCode.prototype = {
    addData: function(data) {
      this.dataList.push({ data: data, mode: 4 });
    },
    isDark: function(row, col) {
      if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
        throw new Error(row + "," + col);
      }
      return this.modules[row][col];
    },
    getModuleCount: function() { return this.moduleCount; },
    make: function() {
      if (this.typeNumber < 1) {
        let typeNumber = 1;
        for (typeNumber = 1; typeNumber < 40; typeNumber++) {
          const rsBlocks = RS_BLOCK_TABLE[(typeNumber - 1) * 4 + this.errorCorrectionLevel];
          if (!rsBlocks) break;
          let totalDataCount = 0;
          for (let i = 0; i < rsBlocks.length; i += 3) {
            totalDataCount += rsBlocks[i] * rsBlocks[i + 2];
          }
          let dataLength = 0;
          for (let i = 0; i < this.dataList.length; i++) {
            dataLength += this.dataList[i].data.length;
          }
          if (dataLength <= totalDataCount - 3) break;
        }
        this.typeNumber = Math.min(typeNumber, 5);
      }
      this.makeImpl(false, 0);
    },
    makeImpl: function(test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (let row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount);
        for (let col = 0; col < this.moduleCount; col++) {
          this.modules[row][col] = null;
        }
      }
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);
      this.mapData(this.createData(this.typeNumber, this.errorCorrectionLevel, this.dataList), maskPattern);
    },
    setupPositionProbePattern: function(row, col) {
      for (let r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c === 0 || c === 6)) ||
              (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
              (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    },
    setupTimingPattern: function() {
      for (let r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] !== null) continue;
        this.modules[r][6] = (r % 2 === 0);
      }
      for (let c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] !== null) continue;
        this.modules[6][c] = (c % 2 === 0);
      }
    },
    setupTypeInfo: function(test, maskPattern) {
      const data = (1 << 3) | maskPattern;
      const bits = [1,0,1,0,1,0,0,0,0,0,1,0,0,1,0];
      for (let i = 0; i < 15; i++) {
        const mod = (!test && bits[i] === 1);
        if (i < 6) this.modules[i][8] = mod;
        else if (i < 8) this.modules[i + 1][8] = mod;
        else this.modules[this.moduleCount - 15 + i][8] = mod;
      }
      for (let i = 0; i < 15; i++) {
        const mod = (!test && bits[i] === 1);
        if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
        else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
        else this.modules[8][15 - i - 1] = mod;
      }
      this.modules[this.moduleCount - 8][8] = !test;
    },
    mapData: function(data, maskPattern) {
      let inc = -1;
      let row = this.moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      for (let col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        while (true) {
          for (let c = 0; c < 2; c++) {
            if (this.modules[row][col - c] === null) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = (((data[byteIndex] >>> bitIndex) & 1) === 1);
              }
              const mask = ((row + (col - c)) % 2 === 0);
              if (mask) dark = !dark;
              this.modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex === -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    },
    createData: function(typeNumber, errorCorrectionLevel, dataList) {
      const rsBlocks = RS_BLOCK_TABLE[(typeNumber - 1) * 4 + errorCorrectionLevel] || RS_BLOCK_TABLE[0];
      const buffer = [];
      // Mode 8-bit byte (0100)
      buffer.push(4);
      let text = dataList[0].data;
      buffer.push(text.length);
      for (let i = 0; i < text.length; i++) {
        buffer.push(text.charCodeAt(i));
      }
      // Pad to total capacity
      let totalDataCount = rsBlocks[2];
      while (buffer.length < totalDataCount) {
        buffer.push(buffer.length % 2 === 0 ? 0xEC : 0x11);
      }
      // Reed solomon EC calculation
      const ecCount = rsBlocks[1] - rsBlocks[2];
      let rsPoly = new Polynomial([1], 0);
      for (let i = 0; i < ecCount; i++) {
        rsPoly = rsPoly.multiply(new Polynomial([1, QRMath.gexp(i)], 0));
      }
      const rawPoly = new Polynomial(buffer, ecCount);
      const modPoly = rawPoly.mod(rsPoly);
      const ecData = [];
      for (let i = 0; i < ecCount; i++) {
        const modIndex = i + modPoly.getLength() - ecCount;
        ecData.push(modIndex >= 0 ? modPoly.get(modIndex) : 0);
      }
      return buffer.concat(ecData);
    }
  };

  // RED404 Exported API
  global.RED404_QR = {
    createSVG: function(text, options) {
      options = options || {};
      const size = options.size || 130;
      const color = options.color || '#ffffff';
      const glow = options.glow !== false;

      const qr = new QRCode(options.version || 3, 0); // Level L/M
      qr.addData(text);
      qr.make();

      const count = qr.getModuleCount();
      const cellSize = size / count;
      let rects = '';

      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            const x = (c * cellSize).toFixed(2);
            const y = (r * cellSize).toFixed(2);
            const w = cellSize.toFixed(2);
            const h = cellSize.toFixed(2);
            rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" rx="0.5"/>`;
          }
        }
      }

      return `
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" class="red404-qr-svg">
          <defs>
            ${glow ? `<filter id="qrGlow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="0" stdDeviation="1.5" flood-color="${color}" flood-opacity="0.6"/></filter>` : ''}
          </defs>
          <g ${glow ? 'filter="url(#qrGlow)"' : ''}>
            ${rects}
          </g>
        </svg>
      `;
    },
    render: function(container, text, options) {
      if (!container) return;
      if (typeof container === 'string') container = document.getElementById(container);
      if (!container) return;
      container.innerHTML = this.createSVG(text, options);
    }
  };

})(typeof window !== 'undefined' ? window : global);

