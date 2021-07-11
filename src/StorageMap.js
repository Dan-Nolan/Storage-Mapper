const ethers = require('ethers');

class StorageMap {
  constructor(contract, storageLayout) {
    this.contract = contract;
    this.storageLayout = storageLayout;
  }
  async _getStorageAt(loc) {
    try {
      const value = await this.contract.provider.getStorageAt(this.contract.address, loc);
      return value;
    }
    catch(ex) {
      // https://github.com/ethers-io/ethers.js/issues/1132
      // appears to have been fixed in hardhat but not in ganache-core yet
      return "0x";
    }
  }
  async getStorage(name, ...args) {
    const { types, storage } = this.storageLayout;

    const entry = storage.find(x => x.label === name);
    if(!entry) {
      console.log(`Storage variable '${name}' not found!`);
    }

    const { label, slot, type, offset } = entry;
    const typeDefinition = types[type];
    // slot is a string with the decimal value of the slot
    const paddedSlot = ethers.utils.hexZeroPad(ethers.BigNumber.from(slot), "32");
    return this._getEntryStorage(label, type, paddedSlot, offset, typeDefinition, ...args);
  }
  async _getEntryStorage(baseLabel, baseType, slot, offset, typeDefinition, ...args) {
    const { encoding } = typeDefinition;
    if(encoding === "inplace") {
      if(baseType.indexOf("t_struct") === 0) {
        if(args.length === 0) {
          // without args a struct is being returned as an object full of all the resolved properties
          let storage = {};
          for(let i = 0; i < typeDefinition.members.length; i++) {
            const { label, type, offset, slot: memberSlot } = typeDefinition.members[i];
            const currentSlot = ethers.BigNumber.from(slot).add(memberSlot).toHexString();
            const newTypeDefinition = this.storageLayout.types[type];
            if(newTypeDefinition.encoding === "dynamic_array") {
              continue; // only get dynamic values on explicit request
            }
            if(newTypeDefinition.encoding === "inplace" && type.indexOf("t_struct") === -1) {
              storage[label] = await this._parseValue(currentSlot, type, offset, newTypeDefinition);
            }
            else {
              storage[label] = await this._getEntryStorage(label, type, currentSlot, offset, newTypeDefinition, ...args);
            }
          }
          return storage;
        }
        else {
          // an explicit request made for a property within a struct
          const prop = args.shift();
          const member = typeDefinition.members.find(x => x.label === prop);
          if(!member) {
            throw new Error(`Member '${prop}' not found!`);
          }
          const { label, type, offset, slot: memberSlot } = member;
          const hexSlot = ethers.BigNumber.from(slot).add(memberSlot).toHexString();
          const newTypeDefinition = this.storageLayout.types[type];
          if(newTypeDefinition.encoding === "inplace" && type.indexOf("t_struct") === -1) {
            return this._parseValue(hexSlot, type, offset, newTypeDefinition);
          }
          else {
            return this._getEntryStorage(label, type, hexSlot, offset, newTypeDefinition, ...args);
          }
        }
      }
      else {
        return this._parseValue(slot, baseType, offset, typeDefinition);
      }
    }
    else if(encoding === "dynamic_array") {
      const index = args.shift();
      const paddedSlot = ethers.utils.hexZeroPad(slot, "32");
      const baseSlot = ethers.utils.keccak256(paddedSlot);
      const newTypeDefinition = this.storageLayout.types[typeDefinition.base];
      const {numberOfBytes} = newTypeDefinition;
      const position = index * numberOfBytes / 32;
      const indexSlot = ethers.BigNumber.from(baseSlot).add(position).toHexString();
      if(this.isValueType(typeDefinition.base)) {
        return this._parseValue(indexSlot, typeDefinition.base, 0, newTypeDefinition);
      }
      else {
        return this._getEntryStorage(baseLabel, typeDefinition.base, indexSlot, 0, newTypeDefinition, ...args);
      }
    }
    else if(encoding === "bytes") {
      // lookup bytes ->
      //   is less than 32 bytes -> return higher-order bytes
      //   is greater -> take the length, go to keccak256(p) and start pulling data
      //              -> next slot is keccak256(p) + 1, keccak256(p) + 2, etc...
      const initialValue = await this._getStorageAt(slot);
      const bytesLength = parseInt(initialValue.slice(-2), 16);
      const isShort = (initialValue.length === 66);
      let val;
      if(isShort) {
        val = initialValue.slice(0, bytesLength + 2);
      }
      else {
        val = "0x";
        const paddedSlot = ethers.utils.hexZeroPad(slot, "32");
        const baseSlot = ethers.utils.keccak256(paddedSlot);
        for(let i = 0; i*64 < bytesLength; i++) {
          const currentSlot = ethers.BigNumber.from(baseSlot).add(i).toHexString();
          const storage = await this._getStorageAt(currentSlot);
          const remainder = bytesLength - (i*64);
          const end = (remainder > 64) ? 64 : (remainder - 1);
          val += storage.slice(2, end + 2);
        }
      }
      if(baseType === "t_string_storage") {
        return ethers.utils.toUtf8String(val);
      }
      else {
        return val;
      }
    }
    else if(encoding === "mapping") {
      const key = args.shift();
      const paddedSlot = ethers.utils.hexZeroPad(slot, "32");
      const paddedKey = ethers.utils.hexZeroPad(key, "32");
      const baseSlot = ethers.utils.keccak256(paddedKey + paddedSlot.slice(2));
      const newTypeDefinition = this.storageLayout.types[typeDefinition.value];
      if(this.isValueType(typeDefinition.value)) {
        return this._parseValue(baseSlot, typeDefinition.value, 0, newTypeDefinition);
      }
      else {
        return this._getEntryStorage(baseLabel, typeDefinition.value, baseSlot, 0, newTypeDefinition, ...args);
      }
    }
  }
  isValueType(type) {
    return (type === "t_bool") ||
      (type.indexOf("t_uint") === 0) ||
      (type.indexOf("t_int") === 0);
  }
  async _parseValue(slot, type, offset, typeDefinition) {
    const value = await this._getStorageAt(slot);
    const paddedValue = ethers.utils.hexZeroPad(value, "32");
    const { numberOfBytes } = typeDefinition;
    const length = paddedValue.length;
    const start = length - numberOfBytes * 2 - offset * 2;
    const end = start + numberOfBytes * 2;
    const sliced = "0x" + paddedValue.slice(start, end);
    return this._parseByType(sliced, type);
  }
  _parseByType(value, type) {
    if(type === "t_bool") {
      return Boolean(parseInt(value));
    }
    else if(type.indexOf("t_uint") === 0) {
      return parseInt(value);
    }
    else if(type.indexOf("t_int") === 0) {
      const size = Number(type.slice(5));
      return ethers.BigNumber.from(value).fromTwos(size).toNumber();
    }
    else {
      return value;
    }
  }
}

module.exports = StorageMap;
