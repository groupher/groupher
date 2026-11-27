# UI interaction checks

## Choosing motion

Start with what the user needs to notice and how often they repeat the action. In Dash, switching tabs repeatedly should reveal the selected panel immediately. A brief confirmation after publishing can help distinguish a successful save from a pending one. Drive that feedback from the confirmed result.

Reuse the timing and styles of a comparable control in the same host. CSS transitions suit a hover, press or toggle that users can reverse mid-flight. Reach for the host's existing Motion implementation when a gesture or coordinated exit needs it. Try reversing the action before it finishes. The last input should win, focus should stay predictable, and the state change should still be clear with reduced motion enabled.

## Mobile interaction

When a control relies on hover, try completing its action by touch and keyboard. Keep the action discoverable on touch and limit hover-only decoration to devices that support it. For sheets and forms, open the on-screen keyboard, focus the last input and check that the primary action remains reachable by scrolling. Preserve pinch zoom. Record which device or emulator you used when reporting a mobile finding.

## Content that stresses the layout

Choose examples the component actually accepts. For a community member row, pair a long display name with a translated role label, then try a missing avatar. Render it at its real container width and check that the identifying text stays useful and the action menu remains reachable. For a list or counter, zero and one often reveal different defects from a large count.

Use the existing fixture, component props or approved local seed path that fits the test. A visual review can exercise these cases without adding a data switch to the product. Report the input, viewport and observed failure so another person can reproduce it.

Further reading from Emil Kowalski’s skills collection: [animate](https://github.com/emilkowalski/skills/tree/main/skills/animate), [mobile-native](https://github.com/emilkowalski/skills/tree/main/skills/mobile-native), [break-ui](https://github.com/emilkowalski/skills/tree/main/skills/break-ui).
