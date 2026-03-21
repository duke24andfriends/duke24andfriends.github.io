import { useParams } from 'react-router-dom';

export const DEFAULT_YEAR = '2026';
export const AVAILABLE_YEARS = ['2026', '2025'] as const;

export const isSupportedYear = (year?: string): year is (typeof AVAILABLE_YEARS)[number] =>
  !!year && AVAILABLE_YEARS.includes(year as (typeof AVAILABLE_YEARS)[number]);

export const getYearPath = (year: string, path = '/'): string => {
  if (!path || path === '/') {
    return `/${year}`;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `/${year}${normalizedPath}`;
};

export const useYearPath = () => {
  const { year } = useParams();
  const activeYear = isSupportedYear(year) ? year : DEFAULT_YEAR;

  return {
    activeYear,
    yearPath: (path = '/') => getYearPath(activeYear, path),
  };
};
