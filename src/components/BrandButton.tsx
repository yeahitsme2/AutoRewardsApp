import { ButtonHTMLAttributes } from 'react';
import { useBrand } from '../lib/BrandContext';

interface BrandButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
}

export function BrandButton({
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: BrandButtonProps) {
  const { brandSettings } = useBrand();

  const getBackgroundColor = () => {
    if (disabled) return '#cbd5e1';
    return variant === 'secondary' ? brandSettings.secondary_color : brandSettings.primary_color;
  };

  const getHoverColor = () => {
    if (disabled) return '#cbd5e1';
    const lightenColor = (color: string) => {
      const hex = color.replace('#', '');
      const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + 20);
      const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + 20);
      const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + 20);
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };
    return lightenColor(getBackgroundColor());
  };

  return (
    <button
      {...props}
      disabled={disabled}
      className={`transition-colors ${disabled ? 'cursor-not-allowed' : ''} ${className}`}
      style={{
        backgroundColor: getBackgroundColor(),
        ...props.style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = getHoverColor();
        }
        props.onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = getBackgroundColor();
        }
        props.onMouseLeave?.(e);
      }}
    >
      {children}
    </button>
  );
}
