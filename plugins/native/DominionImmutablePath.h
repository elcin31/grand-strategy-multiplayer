#pragma once
#include <memory>
#include <utility>
#include "JsiSkHostObjects.h"
#include "include/core/SkPath.h"

namespace RNSkia {
// Original border coordinates, snapshotted once. No mutation methods, builder
// cache, image cache or GPU surface. Finished pictures retain SkPath data.
class JsiDominionImmutablePath
    : public JsiSkWrappingSharedPtrHostObject<const SkPath> {
public:
  JsiDominionImmutablePath(std::shared_ptr<RNSkPlatformContext> context,SkPath path)
      : JsiSkWrappingSharedPtrHostObject<const SkPath>(
          std::move(context),std::make_shared<const SkPath>(std::move(path))) {
    // SkPath's bounds are lazy. Prepare them on the producing JS thread before
    // any picture can share this geometry with the UI/GPU renderer.
    getObject()->updateBoundsCache();
  }
  EXPORT_JSI_API_TYPENAME(JsiDominionImmutablePath,DominionImmutablePath)
  JSI_HOST_FUNCTION(countPoints) {return jsi::Value(getObject()->countPoints());}
  JSI_HOST_FUNCTION(getGenerationID) {return jsi::Value(static_cast<double>(getObject()->getGenerationID()));}
  JSI_EXPORT_FUNCTIONS(JSI_EXPORT_FUNC(JsiDominionImmutablePath,countPoints),
                       JSI_EXPORT_FUNC(JsiDominionImmutablePath,getGenerationID),
                       JSI_EXPORT_FUNC(JsiDominionImmutablePath,dispose))
  size_t getMemoryPressure() const override {
    return isDisposed()?0:getObject()->approximateBytesUsed();
  }
  std::string getObjectType() const override {return "JsiDominionImmutablePath";}
  static std::shared_ptr<const SkPath> read(jsi::Runtime& runtime,const jsi::Value& value) {
    // The typed JSI check rejects ordinary or foreign host objects. getObject
    // also rejects disposed holders, before canvas code dereferences them.
    return value.asObject(runtime).asHostObject<JsiDominionImmutablePath>(runtime)->getObject();
  }
};
}
