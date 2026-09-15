// Vector icon assets
import React from 'react';

import isoDiskSvg from '../assets/icons/iso-disk.svg';
import usbDriveSvg from '../assets/icons/usb-drive.svg';
import sdCardSvg from '../assets/icons/sd-card.svg';
import hardDiskSvg from '../assets/icons/hard-disk.svg';
import diskSvg from '../assets/icons/disk.svg';
import shieldLockSvg from '../assets/icons/shield-lock.svg';
import shieldCheckSvg from '../assets/icons/shield-check.svg';
import speedGaugeSvg from '../assets/icons/speed-gauge.svg';
import dataBytesSvg from '../assets/icons/data-bytes.svg';
import chronometerSvg from '../assets/icons/chronometer.svg';
import ejectMediaSvg from '../assets/icons/eject-media.svg';
import alertCautionSvg from '../assets/icons/alert-caution.svg';
import settingsSlidersSvg from '../assets/icons/settings-sliders.svg';
import adminKeyLockSvg from '../assets/icons/admin-key-lock.svg';
import isoDropzoneHeroSvg from '../assets/icons/iso-dropzone-hero.svg';
import usbWaitingHeroSvg from '../assets/icons/usb-waiting-hero.svg';
import wordmarkSvg from '../assets/icons/wordmark.svg';
import iconSvg from '../assets/icons/icon.svg';
import circularCheckSvg from '../assets/icons/circular-check.svg';

export {
  iconSvg,
  iconSvg as appIconSvg,
  wordmarkSvg,
  wordmarkSvg as logoSvg,
  circularCheckSvg,
  isoDiskSvg,
  usbDriveSvg,
  sdCardSvg,
  hardDiskSvg,
  diskSvg,
  shieldLockSvg,
  shieldCheckSvg,
  speedGaugeSvg,
  dataBytesSvg,
  chronometerSvg,
  ejectMediaSvg,
  alertCautionSvg,
  settingsSlidersSvg,
  adminKeyLockSvg,
  isoDropzoneHeroSvg,
  usbWaitingHeroSvg
};

// Icon component props
export interface IconProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size?: number | string;
  color?: string;
}

// Svg component wrapper
const createSvgIcon = (src: string, defaultSize: number | string = 20, alt = '') => {
  const SvgIcon = React.forwardRef<HTMLImageElement, IconProps>(
    ({ size = defaultSize, color: _color, style, className = '', ...props }, ref) => (
      <img
        ref={ref}
        src={src}
        width={size}
        height={size}
        alt={alt}
        className={`app-icon ${className}`}
        style={{
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
          pointerEvents: 'none',
          userSelect: 'none',
          ...style
        }}
        {...props}
      />
    )
  );
  SvgIcon.displayName = `SvgIcon(${alt || 'Icon'})`;
  return SvgIcon;
};

// Exported icon components
export const IsoDiskIcon = createSvgIcon(isoDiskSvg, 20, 'ISO Disk');
export const UsbDriveIcon = createSvgIcon(usbDriveSvg, 20, 'USB Drive');
export const SdCardIcon = createSvgIcon(sdCardSvg, 20, 'SD Card');
export const HardDiskIcon = createSvgIcon(hardDiskSvg, 20, 'Hard Disk');
export const DiskIcon = createSvgIcon(diskSvg, 20, 'Disk');
export const ShieldLockIcon = createSvgIcon(shieldLockSvg, 20, 'Protected Disk');
export const ShieldCheckIcon = createSvgIcon(shieldCheckSvg, 20, 'Verified');
export const SpeedGaugeIcon = createSvgIcon(speedGaugeSvg, 20, 'Speed');
export const DataBytesIcon = createSvgIcon(dataBytesSvg, 20, 'Data Bytes');
export const ChronometerIcon = createSvgIcon(chronometerSvg, 20, 'Timer');
export const EjectMediaIcon = createSvgIcon(ejectMediaSvg, 20, 'Eject Media');
export const AlertCautionIcon = createSvgIcon(alertCautionSvg, 20, 'Warning');
export const SettingsSlidersIcon = createSvgIcon(settingsSlidersSvg, 20, 'Preferences');
export const AdminKeyLockIcon = createSvgIcon(adminKeyLockSvg, 24, 'Admin Lock');
export const IsoDropzoneHero = createSvgIcon(isoDropzoneHeroSvg, 68, 'Select ISO');
export const UsbWaitingHero = createSvgIcon(usbWaitingHeroSvg, 68, 'Waiting for USB');
export const WordmarkIcon = createSvgIcon(wordmarkSvg, 'auto', 'Flasher');
export const AppIcon = createSvgIcon(iconSvg, 24, 'Flasher');
export const CircularCheckIcon = createSvgIcon(circularCheckSvg, 56, 'Success Check');
