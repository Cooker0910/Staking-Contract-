npx solidity-docgen --solc-settings  "{remappings: ['openzeppelin-solidity=$PWD/node_modules/openzeppelin-solidity']}" --solc-module solc-0.8 -i contracts/contracts/ --templates contracts/docs/
cd ./docs
mv ./CookerStaking.md ./API.md
rm TestToken.md
cd ..