import "@formkit/themes/genesis"
import { genesisIcons } from "@formkit/icons"
import { defineFormKitConfig } from '@formkit/vue'

export default defineFormKitConfig({
  icons: { ...genesisIcons },

})


// import { generateClasses } from '@formkit/themes'
// import { genesisIcons } from "@formkit/icons"
// import "@formkit/themes/genesis"

// export default {
//   icons: {
//     ...genesisIcons
//   },
//   config: {
//     classes: generateClasses({
//       global: {
//         wrapper: '$max-width none'
//       }
//     })
//   }
// }



// import { generateClasses } from '@formkit/themes'
// import { genesisIcons } from '@formkit/icons'
// import myTailwindTheme from './tailwind-theme.js' // change to your theme's path

// export default {
//   icons: {
//     ...genesisIcons,
//   },
//   config: {
//     classes: generateClasses(myTailwindTheme),
//   },
// }