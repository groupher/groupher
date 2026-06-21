import { type ClassValue, clsx } from 'clsx'
import { cn as cnFast } from 'cnfast'

/**
 * Prevents output of unnecessary Tailwind classes and merges classes.
 * useful tips from: https://www.youtube.com/watch?v=re2JFITR7TI
 *
 * @param inputs - Any number of class names or class name arrays.
 * @returns A string of merged class names.
 */
export const cnMerge = (...inputs: ClassValue[]) => cnFast(...inputs)

export const cn = (...inputs: ClassValue[]) => clsx(inputs)

export { getCSSVar } from './helper'
