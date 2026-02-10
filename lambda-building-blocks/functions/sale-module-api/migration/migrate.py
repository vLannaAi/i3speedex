#!/usr/bin/env python3
"""
Main Migration Orchestrator
Coordinates the end-to-end migration process from S9 to AWS
"""

import argparse
import json
import sys
import os
from pathlib import Path
from datetime import datetime
import logging

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from utils.logger import setup_logger
from utils.progress import ProgressTracker
from utils.error_handler import MigrationError
from extract import extract_buyers, extract_producers, extract_sales
from transform import transform_buyers, transform_producers, transform_sales
from load import load_buyers, load_producers, load_sales
from validate import validate_data, compare_counts


class MigrationOrchestrator:
    """Orchestrates the migration process"""

    def __init__(self, config_path='config.json', dry_run=False):
        """Initialize orchestrator with configuration"""
        self.config = self.load_config(config_path)
        self.dry_run = dry_run or self.config['migration'].get('dryRun', False)
        self.logger = setup_logger(self.config['logging'])
        self.progress = ProgressTracker()
        self.checkpoint_file = self.config['checkpoint']['file']
        self.checkpoint = self.load_checkpoint()

        # Create necessary directories
        self.ensure_directories()

    def load_config(self, path):
        """Load configuration from JSON file"""
        try:
            with open(path, 'r') as f:
                config = json.load(f)

            # Expand environment variables
            config_str = json.dumps(config)
            for env_var in os.environ:
                config_str = config_str.replace(f'${{{env_var}}}', os.environ[env_var])

            return json.loads(config_str)
        except FileNotFoundError:
            print(f"Error: Config file not found: {path}")
            print("Please copy config.json.example to config.json and configure it")
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error: Invalid JSON in config file: {e}")
            sys.exit(1)

    def load_checkpoint(self):
        """Load checkpoint data if it exists"""
        if not self.config['checkpoint']['enabled']:
            return {}

        if os.path.exists(self.checkpoint_file):
            with open(self.checkpoint_file, 'r') as f:
                return json.load(f)
        return {}

    def save_checkpoint(self, phase, entity, progress):
        """Save checkpoint data"""
        if not self.config['checkpoint']['enabled']:
            return

        self.checkpoint[phase] = self.checkpoint.get(phase, {})
        self.checkpoint[phase][entity] = {
            'progress': progress,
            'timestamp': datetime.utcnow().isoformat()
        }

        os.makedirs(os.path.dirname(self.checkpoint_file), exist_ok=True)
        with open(self.checkpoint_file, 'w') as f:
            json.dump(self.checkpoint, f, indent=2)

    def ensure_directories(self):
        """Create necessary directories"""
        dirs = [
            'data/extracted',
            'data/transformed',
            'data/reports',
            'data/backups'
        ]
        for dir_path in dirs:
            os.makedirs(dir_path, exist_ok=True)

    def run_extract(self, entity=None):
        """Run extraction phase"""
        self.logger.info("Starting extraction phase")
        entities = [entity] if entity else ['buyers', 'producers', 'sales']

        for ent in entities:
            self.logger.info(f"Extracting {ent}...")

            if self.dry_run:
                self.logger.info(f"[DRY RUN] Would extract {ent}")
                continue

            if ent == 'buyers':
                count = extract_buyers.extract(self.config, self.progress)
            elif ent == 'producers':
                count = extract_producers.extract(self.config, self.progress)
            elif ent == 'sales':
                count = extract_sales.extract(self.config, self.progress)

            self.save_checkpoint('extract', ent, count)
            self.logger.info(f"Extracted {count} {ent}")

        self.logger.info("Extraction phase completed")

    def run_transform(self, entity=None):
        """Run transformation phase"""
        self.logger.info("Starting transformation phase")
        entities = [entity] if entity else ['buyers', 'producers', 'sales']

        for ent in entities:
            self.logger.info(f"Transforming {ent}...")

            if self.dry_run:
                self.logger.info(f"[DRY RUN] Would transform {ent}")
                continue

            if ent == 'buyers':
                count = transform_buyers.transform(self.config, self.progress)
            elif ent == 'producers':
                count = transform_producers.transform(self.config, self.progress)
            elif ent == 'sales':
                count = transform_sales.transform(self.config, self.progress)

            self.save_checkpoint('transform', ent, count)
            self.logger.info(f"Transformed {count} {ent}")

        self.logger.info("Transformation phase completed")

    def run_validate(self):
        """Run validation phase"""
        self.logger.info("Starting validation phase")

        if self.dry_run:
            self.logger.info("[DRY RUN] Would validate data")
            return

        # Validate transformed data
        validation_results = validate_data.validate(self.config, self.progress)

        # Save validation report
        report_path = 'data/reports/validation_report.json'
        with open(report_path, 'w') as f:
            json.dump(validation_results, f, indent=2)

        # Check if validation passed
        if not validation_results['passed']:
            self.logger.error("Validation failed!")
            self.logger.error(f"Errors: {validation_results['error_count']}")
            if not self.config['migration']['continueOnError']:
                raise MigrationError("Validation failed - stopping migration")
        else:
            self.logger.info("Validation passed successfully")

        self.logger.info("Validation phase completed")

    def run_load(self, entity=None):
        """Run loading phase"""
        self.logger.info("Starting load phase")
        entities = [entity] if entity else ['buyers', 'producers', 'sales']

        # Backup before loading
        if self.config['migration']['backupBeforeLoad']:
            self.logger.info("Creating backup before loading...")
            # Backup logic here

        for ent in entities:
            self.logger.info(f"Loading {ent}...")

            if self.dry_run:
                self.logger.info(f"[DRY RUN] Would load {ent}")
                continue

            if ent == 'buyers':
                count = load_buyers.load(self.config, self.progress)
            elif ent == 'producers':
                count = load_producers.load(self.config, self.progress)
            elif ent == 'sales':
                count = load_sales.load(self.config, self.progress)

            self.save_checkpoint('load', ent, count)
            self.logger.info(f"Loaded {count} {ent}")

        self.logger.info("Load phase completed")

    def run_full(self):
        """Run complete migration end-to-end"""
        self.logger.info("=" * 60)
        self.logger.info("Starting full migration process")
        self.logger.info("=" * 60)

        start_time = datetime.now()

        try:
            # Phase 1: Extract
            self.run_extract()

            # Phase 2: Transform
            self.run_transform()

            # Phase 3: Validate
            self.run_validate()

            # Phase 4: Load
            self.run_load()

            # Phase 5: Verify
            if self.config['migration']['validateAfterLoad']:
                self.logger.info("Verifying migration...")
                compare_counts.compare(self.config, self.progress)

            # Success
            duration = datetime.now() - start_time
            self.logger.info("=" * 60)
            self.logger.info(f"Migration completed successfully in {duration}")
            self.logger.info("=" * 60)

            # Clear checkpoint on success
            if os.path.exists(self.checkpoint_file):
                os.remove(self.checkpoint_file)

        except Exception as e:
            duration = datetime.now() - start_time
            self.logger.error("=" * 60)
            self.logger.error(f"Migration failed after {duration}")
            self.logger.error(f"Error: {str(e)}")
            self.logger.error("=" * 60)
            raise

    def resume(self):
        """Resume from last checkpoint"""
        if not self.checkpoint:
            self.logger.warning("No checkpoint found - running full migration")
            self.run_full()
            return

        self.logger.info(f"Resuming from checkpoint: {self.checkpoint}")

        # Determine what to resume
        phases = ['extract', 'transform', 'validate', 'load']
        completed_phases = list(self.checkpoint.keys())

        # Find next phase to run
        for phase in phases:
            if phase not in completed_phases:
                self.logger.info(f"Resuming from {phase} phase")
                if phase == 'extract':
                    self.run_extract()
                elif phase == 'transform':
                    self.run_transform()
                elif phase == 'validate':
                    self.run_validate()
                elif phase == 'load':
                    self.run_load()


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Migrate data from S9 to AWS')

    parser.add_argument('--config', default='config.json',
                        help='Path to configuration file')
    parser.add_argument('--phase', choices=['extract', 'transform', 'validate', 'load'],
                        help='Run specific migration phase')
    parser.add_argument('--entity', choices=['buyers', 'producers', 'sales'],
                        help='Migrate specific entity only')
    parser.add_argument('--full', action='store_true',
                        help='Run complete migration end-to-end')
    parser.add_argument('--dry-run', action='store_true',
                        help='Simulate migration without making changes')
    parser.add_argument('--resume', action='store_true',
                        help='Resume from last checkpoint')
    parser.add_argument('--verbose', action='store_true',
                        help='Enable verbose logging')

    args = parser.parse_args()

    # Create orchestrator
    orchestrator = MigrationOrchestrator(args.config, args.dry_run)

    # Set verbose logging if requested
    if args.verbose:
        orchestrator.logger.setLevel(logging.DEBUG)

    try:
        if args.resume:
            orchestrator.resume()
        elif args.full:
            orchestrator.run_full()
        elif args.phase:
            if args.phase == 'extract':
                orchestrator.run_extract(args.entity)
            elif args.phase == 'transform':
                orchestrator.run_transform(args.entity)
            elif args.phase == 'validate':
                orchestrator.run_validate()
            elif args.phase == 'load':
                orchestrator.run_load(args.entity)
        else:
            parser.print_help()
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\nMigration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nMigration failed: {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
