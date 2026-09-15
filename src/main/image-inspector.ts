import * as fs from 'fs';

// Image inspection result
export interface ImageInspection {
  partitionScheme: 'MBR' | 'GPT' | 'Hybrid' | 'Unknown';
  bootMode: 'UEFI' | 'BIOS' | 'UEFI + BIOS' | 'Unknown';
  targetSystemType: string;
}

// Inspect disk image headers
export async function inspectImage(filePath: string): Promise<ImageInspection> {
  const fd = await fs.promises.open(filePath, 'r');
  const buffer = Buffer.alloc(65536);

  try {
    const { bytesRead } = await fd.read(buffer, 0, 65536, 0);
    if (bytesRead < 512) {
      return { partitionScheme: 'Unknown', bootMode: 'Unknown', targetSystemType: 'Standard BIOS / UEFI' };
    }

    // Inspect boot signatures
    const hasMbrSig = buffer[510] === 0x55 && buffer[511] === 0xaa;
    let hasGptProtective = false;
    let hasEfiPartition = false;
    let hasBootableMbr = false;
    let validMbrCount = 0;

    if (hasMbrSig) {
      // Parse partition entries
      for (let i = 0; i < 4; i++) {
        const offset = 446 + i * 16;
        const bootFlag = buffer[offset];
        const partType = buffer[offset + 4];
        const sectorCount = buffer.readUInt32LE(offset + 12);

        if (bootFlag === 0x80) {
          hasBootableMbr = true;
        }
        if (partType === 0xee) {
          hasGptProtective = true;
        } else if (partType === 0xef) {
          hasEfiPartition = true;
        }

        if (partType !== 0x00 && sectorCount > 0) {
          validMbrCount++;
        }
      }
    }

    // Check GPT header
    let hasGptHeader = false;
    if (bytesRead >= 1024) {
      const gptSig = buffer.toString('ascii', 512, 520);
      hasGptHeader = gptSig === 'EFI PART';
    }

    // Check ISO headers
    let hasIsoSignature = false;
    let hasElTorito = false;
    if (bytesRead >= 34816) {
      // Primary volume descriptor
      const pvdSig = buffer.toString('ascii', 32769, 32774);
      if (pvdSig === 'CD001') {
        hasIsoSignature = true;
      }

      // Check boot record
      const bootRec = buffer.toString('ascii', 34816 + 7, 34816 + 30);
      if (bootRec.includes('EL TORITO SPECIFICATION')) {
        hasElTorito = true;
      }
    }

    // Determine partition scheme
    let partitionScheme: ImageInspection['partitionScheme'] = 'Unknown';
    if (hasGptHeader && validMbrCount > 0 && !hasGptProtective) {
      partitionScheme = 'Hybrid';
    } else if (hasGptHeader || hasGptProtective) {
      partitionScheme = 'GPT';
    } else if (hasMbrSig && (validMbrCount > 0 || hasBootableMbr)) {
      partitionScheme = 'MBR';
    } else if (hasIsoSignature) {
      partitionScheme = 'MBR';
    }

    // Determine boot mode
    let bootMode: ImageInspection['bootMode'] = 'Unknown';
    const hasUefi = hasEfiPartition || hasGptHeader || (hasIsoSignature && hasElTorito);
    const hasBios = hasBootableMbr || (hasMbrSig && buffer[0] !== 0x00) || hasElTorito;

    if (hasUefi && hasBios) {
      bootMode = 'UEFI + BIOS';
    } else if (hasUefi) {
      bootMode = 'UEFI';
    } else if (hasBios) {
      bootMode = 'BIOS';
    }

    // Determine target system
    let targetSystemType = 'Standard BIOS / UEFI';
    if (bootMode === 'UEFI + BIOS') {
      targetSystemType = 'UEFI (non CSM) or BIOS';
    } else if (bootMode === 'UEFI') {
      targetSystemType = 'UEFI (non CSM)';
    } else if (bootMode === 'BIOS') {
      targetSystemType = 'BIOS (or UEFI-CSM)';
    }

    return { partitionScheme, bootMode, targetSystemType };
  } catch {
    return { partitionScheme: 'Unknown', bootMode: 'Unknown', targetSystemType: 'Standard BIOS / UEFI' };
  } finally {
    await fd.close();
  }
}
