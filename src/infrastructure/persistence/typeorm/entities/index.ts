import { GlobalSettingEntity } from './global-setting.entity';
import { SearchBaseCatalogEntity } from './search-base-catalog.entity';
import { WidgetLocaleEntity } from './widget-locale.entity';

export const TYPEORM_ENTITIES: Function[] = [
    WidgetLocaleEntity,
    GlobalSettingEntity,
    SearchBaseCatalogEntity,
];

export {
    GlobalSettingEntity,
    SearchBaseCatalogEntity,
    WidgetLocaleEntity,
};
