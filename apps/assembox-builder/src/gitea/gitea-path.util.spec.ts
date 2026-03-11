import { GiteaPathUtil } from './gitea-path.util';

describe('GiteaPathUtil', () => {
  describe('generateRepoName', () => {
    it('should generate repo name correctly', () => {
      const result = GiteaPathUtil.generateRepoName('order-service', 'backend');
      expect(result).toBe('assembox-configs-order-service-backend');
    });
  });

  describe('generateConfigPath', () => {
    it('should generate system layer config path correctly', () => {
      const result = GiteaPathUtil.generateConfigPath('order', 'v1.0.0', 'system', 'order_controller');
      expect(result).toBe('modules/order/v1.0.0/system/order_controller.json');
    });

    it('should generate tenant layer config path correctly with tenantId', () => {
      const result = GiteaPathUtil.generateConfigPath('order', 'v1.0.0', 'tenant', 'order_controller', 'T001');
      expect(result).toBe('modules/order/v1.0.0/tenant/T001/order_controller.json');
    });

    it('should generate tenant layer config path correctly without tenantId (fall back to non-tenant path)', () => {
      const result = GiteaPathUtil.generateConfigPath('order', 'v1.0.0', 'tenant', 'order_controller');
      expect(result).toBe('modules/order/v1.0.0/tenant/order_controller.json');
    });
  });

  describe('generateSnapshotManifestPath', () => {
    it('should generate snapshot manifest path correctly', () => {
      const result = GiteaPathUtil.generateSnapshotManifestPath('S001');
      expect(result).toBe('snapshots/S001/manifest.json');
    });
  });

  describe('generateSnapshotMetaPath', () => {
    it('should generate snapshot meta path correctly', () => {
      const result = GiteaPathUtil.generateSnapshotMetaPath('S001');
      expect(result).toBe('snapshots/S001/meta.json');
    });
  });

  describe('generateSnapshotTag', () => {
    it('should generate snapshot tag correctly', () => {
      const result = GiteaPathUtil.generateSnapshotTag('S001');
      expect(result).toBe('snapshot-S001');
    });
  });

  describe('generatePublishCommitMessage', () => {
    it('should generate publish commit message correctly', () => {
      const result = GiteaPathUtil.generatePublishCommitMessage(
        'order_controller',
        1,
        'order',
        'v1.0.0',
        'system'
      );
      expect(result).toContain('feat: 发布 order_controller 配置 (v1)');
      expect(result).toContain('- 模块: order');
      expect(result).toContain('- 版本: v1.0.0');
      expect(result).toContain('- 层级: system');
      expect(result).toContain('- 发布版本: 1');
      expect(result).toContain('Co-Authored-By: Assembox Storage Service <noreply@assembox.com>');
    });
  });

  describe('generateBatchPublishCommitMessage', () => {
    it('should generate batch publish commit message correctly', () => {
      const result = GiteaPathUtil.generateBatchPublishCommitMessage(5, 'order-service');
      expect(result).toContain('feat: 批量发布配置 (5个)');
      expect(result).toContain('- 模块组: order-service');
      expect(result).toContain('- 配置数量: 5');
      expect(result).toContain('Co-Authored-By: Assembox Storage Service <noreply@assembox.com>');
    });
  });

  describe('generateSnapshotCommitMessage', () => {
    it('should generate snapshot commit message with description correctly', () => {
      const result = GiteaPathUtil.generateSnapshotCommitMessage('S001', 'Initial Snapshot', 'First snapshot');
      expect(result).toContain('snapshot: 创建快照 S001');
      expect(result).toContain('- 快照名称: Initial Snapshot');
      expect(result).toContain('- 说明: First snapshot');
      expect(result).toContain('Co-Authored-By: Assembox Storage Service <noreply@assembox.com>');
    });

    it('should generate snapshot commit message without description correctly', () => {
      const result = GiteaPathUtil.generateSnapshotCommitMessage('S001', 'Initial Snapshot');
      expect(result).toContain('snapshot: 创建快照 S001');
      expect(result).toContain('- 快照名称: Initial Snapshot');
      expect(result).not.toContain('- 说明:');
      expect(result).toContain('Co-Authored-By: Assembox Storage Service <noreply@assembox.com>');
    });
  });
});
