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

    const { label, slot, type } = entry;
    const typeDefinition = types[type];
    // slot is a string with the decimal value of the slot
    const paddedSlot = ethers.utils.hexZeroPad(ethers.BigNumber.from(slot), "32");
    return this._getEntryStorage(label, type, paddedSlot, typeDefinition, ...args);
  }
  async _getEntryStorage(baseLabel, baseType, slot, typeDefinition, ...args) {
    const { encoding } = typeDefinition;
    if(encoding === "inplace") {
      if(baseType.indexOf("t_struct") === 0) {
        let storage = {};
        for(let i = 0; i < typeDefinition.members.length; i++) {
          const { label, type } = typeDefinition.members[i];
          const currentSlot = ethers.BigNumber.from(slot).add(i).toHexString();
          const value = await this._getStorageAt(currentSlot);
          storage[label] = this.parseValue(value, type);
        }
        return storage;
      }
      else {
        const value = await this._getStorageAt(slot);
        return this.parseValue(value, baseType);
      }
    }
    else if(encoding === "dynamic_array") {
      const index = args.shift();
      const baseSlot = ethers.utils.keccak256(slot);
      const indexSlot = ethers.BigNumber.from(baseSlot).add(index).toHexString();
      if(this.isValueType(typeDefinition.base)) {
        const storage = await this._getStorageAt(indexSlot);
        return this.parseValue(storage, typeDefinition.base);
      }
      else {
        const newTypeDefinition = this.storageLayout.types[typeDefinition.base];
        return this._getEntryStorage(baseLabel, typeDefinition.base, indexSlot, newTypeDefinition, ...args);
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
        const baseSlot = ethers.utils.keccak256(slot);
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
      const paddedKey = ethers.utils.hexZeroPad(key, "32");
      const baseSlot = ethers.utils.keccak256(paddedKey + slot.slice(2));
      if(this.isValueType(typeDefinition.value)) {
        const value = await this._getStorageAt(baseSlot);
        return this.parseValue(value, typeDefinition.value);
      }
      else {
        const newTypeDefinition = this.storageLayout.types[typeDefinition.value];
        return this._getEntryStorage(baseLabel, typeDefinition.value, baseSlot, newTypeDefinition, ...args);
      }
    }
  }
  isValueType(type) {
    return (type === "t_bool") ||
      (type.indexOf("t_uint") === 0) ||
      (type.indexOf("t_int") === 0);
  }
  parseValue(value, type) {
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
