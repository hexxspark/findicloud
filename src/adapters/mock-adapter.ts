import {PathInfo, PathMetadata, PathSource} from '../types';
import {BaseOSAdapter} from './base-adapter';

/**
 * 用于测试的模拟适配器，完全平台无关
 */
export class MockAdapter extends BaseOSAdapter {
  private mockPaths: PathInfo[] = [];

  /**
   * 创建一个新的模拟适配器
   * @param mockPaths 初始模拟路径
   */
  constructor(mockPaths: PathInfo[] = []) {
    super();
    this.mockPaths = mockPaths;

    // 将路径添加到内部映射
    for (const path of mockPaths) {
      this.pathMap.set(path.path, path);
    }
  }

  /**
   * 查找路径（返回预设的模拟路径）
   */
  async findPaths(): Promise<PathInfo[]> {
    return Array.from(this.pathMap.values());
  }

  /**
   * 设置模拟路径
   * @param paths 要设置的路径
   */
  setMockPaths(paths: PathInfo[]): void {
    this.pathMap.clear();
    for (const path of paths) {
      this.pathMap.set(path.path, path);
    }
  }

  /**
   * 添加模拟路径
   * @param path 路径
   * @param metadata 元数据
   * @param isAccessible 是否可访问
   * @param score 分数
   */
  addMockPath(path: string, metadata: PathMetadata, isAccessible = true, score = 100): void {
    this._addPath(path, {source: metadata.source?.source || 'mock'});

    // 更新路径信息
    const pathInfo = this.pathMap.get(path);
    if (pathInfo) {
      pathInfo.isAccessible = isAccessible;
      pathInfo.score = score;
      pathInfo.metadata = {...pathInfo.metadata, ...metadata};
    }
  }

  /**
   * 丰富元数据（简单实现，仅用于测试）
   */
  protected _enrichMetadata(metadata: PathMetadata, path: string, source: PathSource): PathMetadata {
    return {
      ...metadata,
      source,
    };
  }
}
