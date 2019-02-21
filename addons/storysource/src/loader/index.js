import { getOptions } from 'loader-utils';
import path from 'path';
import injectDecorator from './inject-decorator';

const ADD_DECORATOR_STATEMENT =
  '.addDecorator(withStorySource(__STORY__, __ADDS_MAP__,__MODULE_DEPENDENCIES__,__LOCAL_DEPENDENCIES__))';

function extractDependenciesFrom(tree) {
  return !Object.entries(tree || {}).length
    ? []
    : Object.entries(tree)
        .map(([, value]) =>
          (value.dependencies || []).concat(extractDependenciesFrom(value.localDependencies))
        )
        .reduce((acc, value) => acc.concat(value), []);
}

function extractLocalDependenciesFrom(tree) {
  return !Object.entries(tree || {}).length
    ? {}
    : Object.assign(
        ...Object.entries(tree).map(([thisPath, value]) =>
          Object.assign(
            { [thisPath]: value.source },
            extractLocalDependenciesFrom(value.localDependencies)
          )
        )
      );
}

function readAsObject(classLoader, inputSource) {
  const options = getOptions(classLoader) || {};
  const result = injectDecorator(
    inputSource,
    ADD_DECORATOR_STATEMENT,
    classLoader.resourcePath,
    options
  );

  const sourceJson = JSON.stringify(result.storySource || inputSource)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  const addsMap = result.addsMap || {};
  const dependencies = result.dependencies || [];
  const source = result.source || inputSource;

  const moduleDependencies = (result.dependencies || []).filter(d => d[0] === '.' || d[0] === '/');
  const workspaceFileNames = moduleDependencies.map(d =>
    path.join(path.dirname(classLoader.resourcePath), d)
  );
  const renamedModuleDependencies = moduleDependencies.map(md =>
    md
      .replace(/\.\.\//g, 'dotdot/')
      .replace(/^([^./])/, '/$1')
      .replace(/^\.\//, '/')
  );

  return Promise.all(
    workspaceFileNames.map(
      d =>
        new Promise(resolve =>
          classLoader.loadModule(d, (err, dependencyFile, sourceMap, theModule) => {
            resolve({
              d,
              extension: theModule.request.split('.').pop(),
              err,
              dependencyFile,
              sourceMap,
              theModule,
            });
          })
        )
    )
  )
    .then(data =>
      Promise.all(
        data.map(({ dependencyFile, theModule }) =>
          readAsObject(
            Object.assign({}, classLoader, {
              resourcePath: theModule.resourcePath || theModule.resource,
            }),
            dependencyFile
          )
        )
      ).then(moduleObjects =>
        !data || !data.length || !moduleObjects.length
          ? {}
          : Object.assign(
              ...data
                .map(({ extension }, i) => [moduleObjects[i], extension])
                .map(([asObject, extension], i) => ({
                  [`${renamedModuleDependencies[i]}.${extension}`]: asObject,
                }))
            )
      )
    )
    .then(localDependencies => ({
      source,
      sourceJson,
      addsMap,
      dependencies: dependencies
        .concat(extractDependenciesFrom(localDependencies))
        .filter(d => d[0] !== '.' && d[0] !== '/')
        .map(d => (d[0] === '@' ? `${d.split('/')[0]}/${d.split('/')[1]}` : d.split('/')[0])),
      localDependencies: Object.assign(
        ...Object.entries(localDependencies).map(([name, value]) => ({ [name]: value.source })),
        extractLocalDependenciesFrom(localDependencies)
      ),
    }));
}

function transform(inputSource) {
  return readAsObject(this, inputSource).then(
    ({ source, sourceJson, addsMap, dependencies, localDependencies }) => `
  export var withStorySource = require('@storybook/addon-storysource').withStorySource;
  export var __STORY__ = ${sourceJson};
  export var __ADDS_MAP__ = ${JSON.stringify(addsMap)};
  export var __MODULE_DEPENDENCIES__ = ${JSON.stringify(dependencies)};
  export var __LOCAL_DEPENDENCIES__ = ${JSON.stringify(localDependencies)};

  ${source}
  `
  );
}

export default transform;
