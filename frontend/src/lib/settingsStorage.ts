export interface LocalSettingsState {
  warehouse: {
    autoAllocation: boolean;
    strictCapacityCheck: boolean;
    multiWarehouseSearch: boolean;
  };
  inventory: {
    lowStockWarningThreshold: number;
    enableExpiryTracking: boolean;
  };
  alerts: {
    lowStockAlerts: boolean;
    capacityWarnings: boolean;
    movementAlerts: boolean;
  };
}

export const DEFAULT_LOCAL_SETTINGS: LocalSettingsState = {
  warehouse: {
    autoAllocation: true,
    strictCapacityCheck: true,
    multiWarehouseSearch: true,
  },
  inventory: {
    lowStockWarningThreshold: 10,
    enableExpiryTracking: false,
  },
  alerts: {
    lowStockAlerts: true,
    capacityWarnings: true,
    movementAlerts: false,
  },
};

const STORAGE_KEY = 'tiles-wms-settings';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function sanitizeSettings(input: unknown): LocalSettingsState {
  if (!isObject(input)) return DEFAULT_LOCAL_SETTINGS;

  const warehouse = isObject(input.warehouse) ? input.warehouse : {};
  const inventory = isObject(input.inventory) ? input.inventory : {};
  const alerts = isObject(input.alerts) ? input.alerts : {};

  return {
    warehouse: {
      autoAllocation: typeof warehouse.autoAllocation === 'boolean' ? warehouse.autoAllocation : DEFAULT_LOCAL_SETTINGS.warehouse.autoAllocation,
      strictCapacityCheck: typeof warehouse.strictCapacityCheck === 'boolean' ? warehouse.strictCapacityCheck : DEFAULT_LOCAL_SETTINGS.warehouse.strictCapacityCheck,
      multiWarehouseSearch: typeof warehouse.multiWarehouseSearch === 'boolean' ? warehouse.multiWarehouseSearch : DEFAULT_LOCAL_SETTINGS.warehouse.multiWarehouseSearch,
    },
    inventory: {
      lowStockWarningThreshold:
        typeof inventory.lowStockWarningThreshold === 'number' && Number.isFinite(inventory.lowStockWarningThreshold)
          ? inventory.lowStockWarningThreshold
          : DEFAULT_LOCAL_SETTINGS.inventory.lowStockWarningThreshold,
      enableExpiryTracking: typeof inventory.enableExpiryTracking === 'boolean' ? inventory.enableExpiryTracking : DEFAULT_LOCAL_SETTINGS.inventory.enableExpiryTracking,
    },
    alerts: {
      lowStockAlerts: typeof alerts.lowStockAlerts === 'boolean' ? alerts.lowStockAlerts : DEFAULT_LOCAL_SETTINGS.alerts.lowStockAlerts,
      capacityWarnings: typeof alerts.capacityWarnings === 'boolean' ? alerts.capacityWarnings : DEFAULT_LOCAL_SETTINGS.alerts.capacityWarnings,
      movementAlerts: typeof alerts.movementAlerts === 'boolean' ? alerts.movementAlerts : DEFAULT_LOCAL_SETTINGS.alerts.movementAlerts,
    },
  };
}

export function loadLocalSettings(storage?: Pick<Storage, 'getItem'> | null): LocalSettingsState {
  if (!storage) return DEFAULT_LOCAL_SETTINGS;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LOCAL_SETTINGS;
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_LOCAL_SETTINGS;
  }
}

export function saveLocalSettings(settings: LocalSettingsState, storage?: Pick<Storage, 'setItem'> | null) {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export { STORAGE_KEY as localSettingsStorageKey };
