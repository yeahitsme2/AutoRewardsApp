import { ButtonHTMLAttributes } from 'react';
import { useBrand } from '../lib/BrandContext';

interface BrandButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent';
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
    switch (variant) {
      case 'secondary':
        return brandSettings.secondary_color;
      case 'accent':
        return brandSettings.accent_color;
      default:
        return brandSettings.primary_color;
    }
  };

  const getHoverColor = () => {
    if (disabled) return '#cbd5e1';
    switch (variant) {
      case 'primary':
        return brandSettings.secondary_color;
      case 'secondary':
        return brandSettings.accent_color;
      case 'accent':
        return brandSettings.primary_color;
      default:
        return brandSettings.secondary_color;
    }
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
