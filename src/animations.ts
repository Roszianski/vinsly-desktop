import { Variants } from 'framer-motion';

// Page Transitions
export const pageTransition: Variants = {
  initial: {
    opacity: 0,
    x: -20
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

// List Container - for staggered children
export const listContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.05
    }
  }
};

// List Item - individual items in a staggered list
export const listItem: Variants = {
  hidden: {
    opacity: 0,
    y: 10
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

// Card Hover - for agent cards and other hoverable cards
export const cardHover: Variants = {
  rest: {
    scale: 1,
    y: 0,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  },
  hover: {
    scale: 1.01,
    y: -2,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  },
  tap: {
    scale: 0.99,
    y: 0,
    transition: {
      duration: 0.08,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

// Button Interactions
export const buttonVariants: Variants = {
  rest: {
    scale: 1,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  },
  hover: {
    scale: 1.02,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.08,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

// Small Button (for icon buttons)
export const iconButtonVariants: Variants = {
  rest: {
    scale: 1,
    opacity: 0.7,
    transition: {
      duration: 0.2
    }
  },
  hover: {
    scale: 1.1,
    opacity: 1,
    transition: {
      duration: 0.2
    }
  },
  tap: {
    scale: 0.95,
    opacity: 0.8,
    transition: {
      duration: 0.1
    }
  }
};

// Modal/Dialog
export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.15
    }
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.15
    }
  }
};

// Modal Backdrop
export const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.15 }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 }
  }
};

// Toast Notification
export const toastVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -50,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 40
    }
  },
  exit: {
    opacity: 0,
    x: 50,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

// Wizard Step Transitions
export const wizardStepVariants: Variants = {
  enter: (direction: number) => {
    return {
      x: direction > 0 ? 30 : -30,
      opacity: 0
    };
  },
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  },
  exit: (direction: number) => {
    return {
      x: direction < 0 ? 30 : -30,
      opacity: 0,
      transition: {
        duration: 0.2,
        ease: [0.25, 0.1, 0.25, 1.0]
      }
    };
  }
};

// Form Input Focus
export const inputFocusVariants: Variants = {
  blur: {
    scale: 1,
    transition: {
      duration: 0.15
    }
  },
  focus: {
    scale: 1.005,
    transition: {
      duration: 0.15,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

// Badge Pulse (for high-risk badges)
export const badgePulseVariants: Variants = {
  rest: {
    scale: 1
  },
  pulse: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      repeatDelay: 2
    }
  }
};

// Checkbox Check Animation
export const checkboxVariants: Variants = {
  unchecked: {
    pathLength: 0,
    opacity: 0,
    transition: { duration: 0.15 }
  },
  checked: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

// Fade In (simple fade)
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2 }
  }
};

// Slide Up (for bottom sheets, tooltips)
export const slideUp: Variants = {
  hidden: {
    opacity: 0,
    y: 20
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  },
  exit: {
    opacity: 0,
    y: 10,
    transition: {
      duration: 0.15
    }
  }
};

// Loading Shimmer (for skeleton screens)
export const shimmerVariants: Variants = {
  initial: {
    backgroundPosition: '-200% 0'
  },
  animate: {
    backgroundPosition: '200% 0',
    transition: {
      duration: 1.2,
      ease: 'linear',
      repeat: Infinity
    }
  }
};

// Success Checkmark
export const checkmarkVariants: Variants = {
  hidden: {
    pathLength: 0,
    opacity: 0
  },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

// Theme Toggle Icon Rotation
export const themeToggleVariants: Variants = {
  light: {
    rotate: 0,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  },
  dark: {
    rotate: 180,
    scale: 1,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

// Hover Actions (for quick actions on hover)
export const hoverActionsVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 10,
    transition: {
      duration: 0.15
    }
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.15,
      staggerChildren: 0.05
    }
  }
};

// Scale Pop (for success states, notifications)
export const scalePop: Variants = {
  initial: {
    scale: 0.8,
    opacity: 0
  },
  animate: {
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 25
    }
  },
  exit: {
    scale: 0.8,
    opacity: 0,
    transition: {
      duration: 0.15
    }
  }
};

// Drawer Slide (for sidebars)
export const drawerVariants: Variants = {
  closed: {
    x: '-100%',
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  },
  open: {
    x: 0,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

// Menu Item (for dropdown menus)
export const menuItemVariants: Variants = {
  rest: {
    x: 0,
    backgroundColor: 'transparent',
    transition: {
      duration: 0.15
    }
  },
  hover: {
    x: 4,
    transition: {
      duration: 0.15
    }
  }
};

// Collapse/Expand (for accordions)
export const collapseVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      duration: 0.2,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  }
};

// Guided Tour Tooltip
export const tourTooltipVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: -10
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.1, 0.25, 1.0]
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: {
      duration: 0.2
    }
  }
};

// Tour Spotlight/Highlight
export const tourHighlightVariants: Variants = {
  hidden: {
    opacity: 0
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3
    }
  }
};
