/*
 *
 * common styles used in styled-component
 *
 */

import { twMerge } from 'tailwind-merge'
import { clsx, type ClassValue } from 'clsx'

/**
 * Prevents output of unnecessary Tailwind classes and merges classes.
 * usefull tips from: https://www.youtube.com/watch?v=re2JFITR7TI
 *
 * @param inputs - Any number of class names or class name arrays.
 * @returns A string of merged class names.
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

export const css = {}

export { theme } from '../themes'
export { WIDTH } from './metric'
export type { TZIndexKey } from './zindex'
