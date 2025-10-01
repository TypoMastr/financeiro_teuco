import React, { useState, useEffect } from 'react';
import { motion, Variants } from 'framer-motion';

const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
    exit: { y: 20, opacity: 0 }
};

const defaultInputClass = "block w-full bg-card dark:bg-dark-input border border-border dark:border-dark-border focus:ring-2 focus:ring-ring focus:outline-none transition-all text-base rounded-lg shadow-sm";
const defaultLabelClass = "block text-base font-semibold text-foreground dark:text-dark-foreground";
const defaultSmallLabelClass = "block text-xs font-medium text-muted-foreground mb-1.5";


// --- TextInput ---
interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    id: string;
    label: string;
    icon?: React.ReactNode;
}
export const TextInput = React.memo<TextInputProps>(({ id, label, icon, ...props }) => (
    <motion.div variants={itemVariants}>
        <label htmlFor={id} className={defaultLabelClass}>{label}</label>
        <div className="relative mt-2">
            {icon && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
            <input
                id={id}
                {...props}
                className={`${defaultInputClass} py-3 pr-4 ${icon ? 'pl-12' : 'pl-4'}`}
            />
        </div>
    </motion.div>
));

// --- CurrencyInput ---
interface CurrencyInputProps {
    id: string;
    label: string;
    value: number;
    onValueChange: (value: number) => void;
    icon?: React.ReactNode;
    required?: boolean;
}
export const CurrencyInput: React.FC<CurrencyInputProps> = ({ id, label, value, onValueChange, icon, required }) => {
    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const [displayValue, setDisplayValue] = useState(formatCurrency(value));

    useEffect(() => {
        setDisplayValue(formatCurrency(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
        onValueChange(numericValue);
        setDisplayValue(formatCurrency(numericValue));
    };
    
    return (
        <motion.div variants={itemVariants}>
            <label htmlFor={id} className={defaultLabelClass}>{label}</label>
            <div className="relative mt-2">
                {icon && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
                <input
                    type="text"
                    id={id}
                    value={displayValue}
                    onChange={handleChange}
                    required={required}
                    className={`${defaultInputClass} py-3 pr-4 ${icon ? 'pl-12' : 'pl-4'}`}
                />
            </div>
        </motion.div>
    );
};

// --- CheckboxInput ---
interface CheckboxInputProps {
    id: string;
    label: string;
    checked: boolean;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
export const CheckboxInput: React.FC<CheckboxInputProps> = ({ id, label, checked, onChange }) => (
    <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 bg-background dark:bg-dark-input p-3 border border-border dark:border-dark-border rounded-lg">
            <input
                type="checkbox"
                id={id}
                name={id}
                checked={checked}
                onChange={onChange}
                className="h-5 w-5 rounded border-border dark:border-dark-border text-primary focus:ring-primary"
            />
            <label htmlFor={id} className={`${defaultLabelClass} cursor-pointer`}>
                {label}
            </label>
        </div>
    </motion.div>
);

// --- DateField (Moved from PageLayout) ---
interface DateFieldProps {
  id: string;
  label: string;
  value: string; // Expects YYYY-MM-DD
  onChange: (value: string) => void; // Sends back YYYY-MM-DD
  required?: boolean;
  className?: string;
  smallLabel?: boolean;
}

const formatDateForDisplay = (isoDate: string): string => {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate.slice(0, 10))) return '';
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

const parseDateFromDisplay = (displayDate: string): string => {
  if (!displayDate || !/^\d{2}\/\d{2}\/\d{4}$/.test(displayDate)) return '';
  const [day, month, year] = displayDate.split('/');
  return `${year}-${month}-${day}`;
};

export const DateField: React.FC<DateFieldProps> = ({ id, label, value, onChange, required, className = '', smallLabel = false }) => {
  const [displayValue, setDisplayValue] = useState(formatDateForDisplay(value));

  useEffect(() => {
    setDisplayValue(formatDateForDisplay(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value.replace(/\D/g, '');
    let formatted = '';
    if (input.length > 0) formatted = input.slice(0, 2);
    if (input.length > 2) formatted += '/' + input.slice(2, 4);
    if (input.length > 4) formatted += '/' + input.slice(4, 8);
    setDisplayValue(formatted);
    if (formatted.length === 10) {
      const [day, month, year] = formatted.split('/').map(Number);
      if (year > 1900 && month > 0 && month <= 12 && day > 0 && day <= 31) {
        onChange(parseDateFromDisplay(formatted));
      }
    }
  };
  
  const finalLabelClass = smallLabel ? defaultSmallLabelClass : defaultLabelClass;
  const marginTop = smallLabel ? '' : 'mt-2';

  return (
    <div>
      {label && <label htmlFor={id} className={finalLabelClass}>{label}</label>}
      <input
        type="text"
        id={id}
        value={displayValue}
        onChange={handleInputChange}
        placeholder="dd/mm/aaaa"
        required={required}
        className={`${defaultInputClass} ${smallLabel ? 'text-sm p-2.5' : 'p-3'} ${marginTop} ${className}`}
        maxLength={10}
      />
    </div>
  );
};