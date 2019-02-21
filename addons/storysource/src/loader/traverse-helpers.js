import { handleADD, handleSTORYOF, asImport, patchNode } from './parse-helpers';

const estraverse = require('estraverse');

export function splitSTORYOF(ast, source) {
  let lastIndex = 0;
  const parts = [source];

  estraverse.traverse(ast, {
    fallback: 'iteration',
    enter: node => {
      patchNode(node);

      if (node.type === 'CallExpression') {
        lastIndex = handleSTORYOF(node, parts, source, lastIndex);
      }
    },
  });

  return parts;
}

export function findAddsMap(ast) {
  const adds = {};

  estraverse.traverse(ast, {
    fallback: 'iteration',
    enter: (node, parent) => {
      patchNode(node);

      if (node.type === 'MemberExpression') {
        handleADD(node, parent, adds);
      }
    },
  });

  return adds;
}

export function findDependencies(ast) {
  const dependencies = [];

  estraverse.traverse(ast, {
    fallback: 'iteration',
    enter: (node, parent) => {
      patchNode(node);

      if (node.type === 'ImportDeclaration') {
        dependencies.push(asImport(node, parent));
      }
    },
  });
  return dependencies;
}
