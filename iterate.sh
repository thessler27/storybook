#!/bin/bash

set -e

rm -rf ~/Library/Caches/Yarn/v4/npm-@storybook**
rm -rf ~/Library/Caches/Yarn/v4/.tmp
cd app/react-native
yarn prepare
yarn pack
mv storybook-react-native-v5.0.0-beta.3.tgz ../../packs/storybook-react-native.tgz
cd ../..
cd app/react-native-server
yarn prepare
yarn pack
mv storybook-react-native-server-v5.0.0-beta.3.tgz ../../packs/storybook-react-native-server.tgz
cd ../..
yarn
cd examples-native/crna-kitchen-sink
rm yarn.lock && rm -rf node_modules && yarn install