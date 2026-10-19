Drop your own background-reveal images in this folder (PNG or JPG, roughly
square or portrait works best since the page scrolls vertically -- 1000px+
on the long edge recommended). Then add an entry for each one to
BACKGROUND_POOL in src/components/DestroyModeOverlay.tsx:

  { id: 'custom-my-image', src: '/games/backgrounds/custom/my-image.png', name: 'My Image' }

`id` must be unique and, once anyone has unlocked it, should never be
renamed or removed -- that id is what's stored in the database against
their visitorId/account.
