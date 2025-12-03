import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Prevents output of unnecessary Tailwind classes and merges classes.
 * useful tips from: https://www.youtube.com/watch?v=re2JFITR7TI
 *
 * @param inputs - Any number of class names or class name arrays.
 * @returns A string of merged class names.
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export { getCSSVar, setGlobalCSSVar } from './helper'
// TODO: remove
export { WIDTH } from './metric'
