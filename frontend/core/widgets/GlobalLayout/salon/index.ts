export default function useSalon() {
  /**
 * see layout details:
 " @link https://css-tricks.com/the-fixed-background-attachment-hack/
 */
  return {
    wrapper: 'row justify-center',
    scrollWrapper: 'absolute w-full',
    skeleton: 'w-screen h-screen antialiased',
  }
}
