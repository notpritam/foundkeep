import { tagEntry } from '../../card.js';

export default {
  title: 'Extension/Card controls/Tag entry',
  render: args => tagEntry(args),
  args: { legend: 'Personal tags', tags: [], typed: '', error: false },
  argTypes: { tags: { control: 'object' } },
  parameters: { surface: 'card', docs: { description: { component: 'The whole tag control, rendered by the real `bindSaveTags()` from save-details.js — type, press Enter or comma, click suggestions and chosen chips here and it behaves exactly as in the card. The entry input sits outside `.field`, so it gets none of the text-field styling.' } } },
};
export const Empty = {};
export const WithTags = { name: 'With tags', args: { tags: ['Memory', 'Reading'] } };
export const Typing = { args: { tags: ['Memory'], typed: 'wor' } };
export const Focus = { parameters: { pseudo: { focus: ['input'] } } };
export const Error = { args: { tags: ['Memory'], typed: 'a very long tag that goes past the forty character limit', error: true } };
export const CollectionTags = { name: 'Collection tags', args: { legend: 'Tags in collection', tags: ['Learning'] } };
