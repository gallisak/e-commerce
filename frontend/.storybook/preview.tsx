import type { Preview } from '@storybook/react-vite';
import type { StoryParameters } from '@/test/storybook';
import { StoryProviders, ThemeFrame } from './story-providers';
import '../src/index.css';

const preview: Preview = {
  decorators: [
    (Story, context) => (
      <ThemeFrame dark={context.globals.theme === 'dark'}>
        <Story />
      </ThemeFrame>
    ),
    (Story, context) => (
      <StoryProviders parameters={context.parameters as StoryParameters}>
        <Story />
      </StoryProviders>
    ),
  ],
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { test: 'error' },
  },
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
};

export default preview;
