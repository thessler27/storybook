import addons from '@storybook/addons';
import { STORY_EVENT_ID } from './events';

const getLocation = (context, locationsMap) => locationsMap[context.id];

function setStorySource(context, source, locationsMap, dependencies, localDependencies) {
  const channel = addons.getChannel();
  const currentLocation = getLocation(context, locationsMap);
  const {
    parameters: { fileName },
  } = context;

  channel.emit(STORY_EVENT_ID, {
    source,
    currentLocation,
    locationsMap,
    fileName,
    dependencies,
    localDependencies,
  });
}

export function withStorySource(
  source,
  locationsMap = {},
  dependencies = [],
  localDependencies = {}
) {
  return (story, context) => {
    setStorySource(context, source, locationsMap, dependencies, localDependencies);
    return story();
  };
}
